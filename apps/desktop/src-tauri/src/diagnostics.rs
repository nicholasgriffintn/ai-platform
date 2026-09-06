use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub app_version: String,
    pub target: String,
    pub api_base_url: String,
    pub database_path: String,
    pub endpoint_count: usize,
    pub keychain_available: bool,
    pub signed_in: bool,
    pub collected_at: String,
}
