//! Rust client for the Oracle Truth gate API.
//!
//! Read-only HTTP client — no keys, no trading. Uses std HTTP (no TLS deps).

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpStream;
use thiserror::Error;

pub type PerpAsset = String;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReasonCode {
    OracleStale,
    DivergedXBps,
    RpcBehind,
    VenuesDisagree,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GateDecision {
    Allow,
    Refuse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VenuePrice {
    pub venue: String,
    pub price: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GateEvidence {
    pub asset: String,
    pub timestamp: String,
    pub spot_reference: serde_json::Value,
    pub venue_prices: Vec<VenuePrice>,
    #[serde(default)]
    pub venue_spread_bps: serde_json::Value,
    pub mark_price: Option<serde_json::Value>,
    pub oracle_price: Option<serde_json::Value>,
    #[serde(default)]
    pub divergence_bps: serde_json::Value,
    #[serde(default)]
    pub oracle_age_ms: serde_json::Value,
    #[serde(default)]
    pub rpc: Option<serde_json::Value>,
    pub thresholds: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GateResult {
    pub decision: GateDecision,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason_code: Option<ReasonCode>,
    pub evidence: GateEvidence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolutionEvidence {
    pub question: String,
    pub asset: String,
    pub strike_price: f64,
    pub resolution_time: String,
    pub sources: Vec<serde_json::Value>,
    pub median_price: serde_json::Value,
    pub can_resolve: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolve_direction: Option<String>,
}

#[derive(Debug, Error)]
pub enum ClientError {
    #[error("HTTP transport error: {0}")]
    Transport(String),
    #[error("API error {status}: {body}")]
    Api { status: u16, body: String },
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("URL error: {0}")]
    Url(String),
}

pub struct OracleTruthClient {
    base_url: String,
}

impl OracleTruthClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
        }
    }

    pub fn from_env() -> Self {
        let base = std::env::var("ORACLE_TRUTH_URL").unwrap_or_else(|_| "http://localhost:3000".into());
        Self::new(base)
    }

    pub fn check_gate(&self, asset: &str) -> Result<GateResult, ClientError> {
        let url = format!("{}/api/gate/{}", self.base_url, asset);
        self.get_json(&url)
    }

    pub fn check_gate_fixture(&self, asset: &str, fixture: &str) -> Result<GateResult, ClientError> {
        let url = format!(
            "{}/api/gate/{}?mode=fixture&fixture={}",
            self.base_url, asset, fixture
        );
        self.get_json(&url)
    }

    pub fn should_allow_trade(&self, asset: &str) -> Result<bool, ClientError> {
        Ok(self.check_gate(asset)?.decision == GateDecision::Allow)
    }

    pub fn get_resolution_evidence(&self, asset: &str, strike: f64) -> Result<ResolutionEvidence, ClientError> {
        let url = format!(
            "{}/api/prediction/resolve?asset={}&strike={}",
            self.base_url, asset, strike
        );
        self.get_json(&url)
    }

    fn get_json<T: for<'de> Deserialize<'de>>(&self, url: &str) -> Result<T, ClientError> {
        let body = http_get(url)?;
        Ok(serde_json::from_str(&body)?)
    }
}

fn http_get(url: &str) -> Result<String, ClientError> {
    let parsed = url::Url::parse(url).map_err(|e| ClientError::Url(e))?;
    let host = parsed.host_str().ok_or_else(|| ClientError::Url("missing host".into()))?;
    let port = parsed.port_or_known_default().unwrap_or(80);
    let path = parsed.path();
    let query = parsed.query().map(|q| format!("?{q}")).unwrap_or_default();
    let request_path = if query.is_empty() {
        path.to_string()
    } else {
        format!("{path}{query}")
    };

    let mut stream = TcpStream::connect(format!("{host}:{port}"))
        .map_err(|e| ClientError::Transport(e.to_string()))?;

    let request = format!(
        "GET {request_path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\nAccept: application/json\r\n\r\n"
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| ClientError::Transport(e.to_string()))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|e| ClientError::Transport(e.to_string()))?;

    let (status, body) = parse_http_response(&response)?;
    if status >= 400 {
        return Err(ClientError::Api { status, body });
    }
    Ok(body)
}

fn parse_http_response(raw: &str) -> Result<(u16, String), ClientError> {
    let mut parts = raw.splitn(2, "\r\n\r\n");
    let header = parts.next().unwrap_or("");
    let body = parts.next().unwrap_or("").to_string();
    let status_line = header.lines().next().unwrap_or("");
    let status: u16 = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(500);
    Ok((status, body))
}

// Minimal URL parser to avoid extra deps
mod url {
    #[derive(Debug)]
    pub struct Url {
        pub scheme: String,
        pub host: String,
        pub port: Option<u16>,
        pub path: String,
        pub query: Option<String>,
    }

    impl Url {
        pub fn parse(input: &str) -> Result<Self, String> {
            let rest = input
                .strip_prefix("http://")
                .or_else(|| input.strip_prefix("https://"))
                .ok_or_else(|| "only http supported in std client".to_string())?;
            let (authority, path_query) = match rest.find('/') {
                Some(i) => (&rest[..i], &rest[i..]),
                None => (rest, "/"),
            };
            let (host, port) = match authority.rfind(':') {
                Some(i) => {
                    let (h, p) = authority.split_at(i);
                    (h.to_string(), p.trim_start_matches(':').parse().ok())
                }
                None => (authority.to_string(), None),
            };
            let (path, query) = match path_query.find('?') {
                Some(i) => (path_query[..i].to_string(), Some(path_query[i + 1..].to_string())),
                None => (path_query.to_string(), None),
            };
            Ok(Self {
                scheme: "http".into(),
                host,
                port,
                path,
                query,
            })
        }

        pub fn host_str(&self) -> Option<&str> {
            Some(&self.host)
        }

        pub fn port_or_known_default(&self) -> Option<u16> {
            Some(self.port.unwrap_or(80))
        }

        pub fn path(&self) -> &str {
            &self.path
        }

        pub fn query(&self) -> Option<&str> {
            self.query.as_deref()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_fixture_gate_result() {
        let json = r#"{
            "decision": "refuse",
            "reasonCode": "ORACLE_STALE",
            "evidence": {
                "asset": "SOL",
                "timestamp": "2026-09-25T12:00:00.000Z",
                "spotReference": 145.5,
                "venuePrices": [],
                "thresholds": {}
            }
        }"#;
        let result: GateResult = serde_json::from_str(json).expect("parse");
        assert_eq!(result.decision, GateDecision::Refuse);
        assert_eq!(result.reason_code, Some(ReasonCode::OracleStale));
    }

    #[test]
    fn parses_http_response() {
        let raw = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"ok\":true}";
        let (status, body) = parse_http_response(raw).unwrap();
        assert_eq!(status, 200);
        assert_eq!(body, "{\"ok\":true}");
    }
}
