use keyring::Entry;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

static CACHE: LazyLock<Mutex<HashMap<String, Option<String>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub const SESSION: &str = "authenticated-session";

const SERVICE: &str = "uk.co.nicholasgriffin.polychat.desktop";

pub fn pairing_key(endpoint_id: &str) -> String {
    format!("pairing:{endpoint_id}")
}

fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|cause| cause.to_string())
}

pub fn store(name: &str, secret: &str) -> Result<(), String> {
    let mut cache = CACHE.lock().map_err(|cause| cause.to_string())?;
    entry(name)?
        .set_password(secret)
        .map_err(|cause| cause.to_string())?;
    cache.insert(name.to_string(), Some(secret.to_string()));
    Ok(())
}

pub fn read(name: &str) -> Result<Option<String>, String> {
    let mut cache = CACHE.lock().map_err(|cause| cause.to_string())?;
    if let Some(secret) = cache.get(name) {
        return Ok(secret.clone());
    }
    let secret = match entry(name)?.get_password() {
        Ok(secret) => Some(secret),
        Err(keyring::Error::NoEntry) => None,
        Err(cause) => return Err(cause.to_string()),
    };
    cache.insert(name.to_string(), secret.clone());
    Ok(secret)
}

pub fn forget(name: &str) -> Result<(), String> {
    let mut cache = CACHE.lock().map_err(|cause| cause.to_string())?;
    match entry(name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            cache.insert(name.to_string(), None);
            Ok(())
        }
        Err(cause) => Err(cause.to_string()),
    }
}
