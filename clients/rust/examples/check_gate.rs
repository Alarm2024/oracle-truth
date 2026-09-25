use oracle_truth_client::OracleTruthClient;

fn main() {
    let client = OracleTruthClient::from_env();
    for asset in ["SOL", "BTC", "ETH"] {
        match client.check_gate(asset) {
            Ok(result) => {
                let reason = result
                    .reason_code
                    .map(|r| format!(" ({:?})", r))
                    .unwrap_or_default();
                println!("{}: {:?}{}", asset, result.decision, reason);
            }
            Err(e) => println!("{}: ERROR — {}", asset, e),
        }
    }
}
