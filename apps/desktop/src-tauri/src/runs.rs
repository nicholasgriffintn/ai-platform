use std::collections::HashSet;
use std::sync::Mutex;

use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        run_id: String,
        endpoint_id: String,
        at: String,
    },
    #[serde(rename_all = "camelCase")]
    Progress { run_id: String, state: String },
    #[serde(rename_all = "camelCase")]
    Text { run_id: String, delta: String },
    #[serde(rename_all = "camelCase")]
    Failed {
        run_id: String,
        failure: String,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    Finished {
        run_id: String,
        reason: String,
        at: String,
    },
}

#[derive(Default)]
pub struct RunRegistry {
    cancelled: Mutex<HashSet<String>>,
}

impl RunRegistry {
    pub fn cancel(&self, run_id: &str) {
        if let Ok(mut cancelled) = self.cancelled.lock() {
            cancelled.insert(run_id.to_string());
        }
    }

    pub fn is_cancelled(&self, run_id: &str) -> bool {
        self.cancelled
            .lock()
            .map(|cancelled| cancelled.contains(run_id))
            .unwrap_or(false)
    }

    pub fn forget(&self, run_id: &str) {
        if let Ok(mut cancelled) = self.cancelled.lock() {
            cancelled.remove(run_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_only_the_run_that_was_cancelled() {
        let registry = RunRegistry::default();

        registry.cancel("run-1");

        assert!(registry.is_cancelled("run-1"));
        assert!(!registry.is_cancelled("run-2"));
    }

    #[test]
    fn stops_reporting_a_run_once_it_is_forgotten() {
        let registry = RunRegistry::default();

        registry.cancel("run-1");
        registry.forget("run-1");

        assert!(!registry.is_cancelled("run-1"));
    }
}
