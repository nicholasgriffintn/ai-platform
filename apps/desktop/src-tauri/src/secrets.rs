use keyring::Entry;

const SERVICE: &str = "uk.co.nicholasgriffin.polychat.desktop";

pub fn pairing_key(endpoint_id: &str) -> String {
    format!("pairing:{endpoint_id}")
}

fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|cause| cause.to_string())
}

pub fn store(name: &str, secret: &str) -> Result<(), String> {
    entry(name)?
        .set_password(secret)
        .map_err(|cause| cause.to_string())
}

pub fn read(name: &str) -> Result<Option<String>, String> {
    match entry(name)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(cause) => Err(cause.to_string()),
    }
}

pub fn forget(name: &str) -> Result<(), String> {
    match entry(name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(cause) => Err(cause.to_string()),
    }
}
