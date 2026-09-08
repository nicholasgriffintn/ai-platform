use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub app_version: String,
    pub machine_id: String,
    pub platform: String,
    pub target: String,
    pub api_base_url: String,
    pub database_path: String,
    pub endpoint_count: usize,
    pub collected_at: String,
}
