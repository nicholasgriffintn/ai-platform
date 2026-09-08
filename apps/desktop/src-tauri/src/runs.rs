use std::collections::HashSet;
use std::path::{Path, PathBuf};
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
        head: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Progress { run_id: String, state: String },
    #[serde(rename_all = "camelCase")]
    Text { run_id: String, delta: String },
    #[serde(rename_all = "camelCase")]
    RawOutput { run_id: String, data: String },
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
    active: Mutex<HashSet<String>>,
    active_directories: Mutex<HashSet<String>>,
    cancelled: Mutex<HashSet<String>>,
}

pub struct DirectoryRunGuard<'a> {
    registry: &'a RunRegistry,
    directory: PathBuf,
    run_id: String,
}

impl Drop for DirectoryRunGuard<'_> {
    fn drop(&mut self) {
        self.registry.finish_directory(&self.directory);
        self.registry.forget(&self.run_id);
    }
}

impl RunRegistry {
    pub fn acquire_directory(
        &self,
        directory: &Path,
        run_id: &str,
    ) -> Option<DirectoryRunGuard<'_>> {
        if !self.begin_directory(directory) {
            return None;
        }
        self.begin(run_id);
        Some(DirectoryRunGuard {
            registry: self,
            directory: directory.to_path_buf(),
            run_id: run_id.to_string(),
        })
    }
    pub fn begin(&self, run_id: &str) {
        if let Ok(mut active) = self.active.lock() {
            active.insert(run_id.to_string());
        }
    }

    pub fn begin_directory(&self, directory: &Path) -> bool {
        let Ok(mut active) = self.active_directories.lock() else {
            return false;
        };

        active.insert(directory.to_string_lossy().into_owned())
    }

    pub fn finish_directory(&self, directory: &Path) {
        if let Ok(mut active) = self.active_directories.lock() {
            active.remove(directory.to_string_lossy().as_ref());
        }
    }

    pub fn cancel(&self, run_id: &str) {
        let is_active = self
            .active
            .lock()
            .map(|active| active.contains(run_id))
            .unwrap_or(false);

        if !is_active {
            return;
        }

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
        if let Ok(mut active) = self.active.lock() {
            active.remove(run_id);
        }

        if let Ok(mut cancelled) = self.cancelled.lock() {
            cancelled.remove(run_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn releases_a_directory_and_cancellation_when_a_run_exits_early() {
        let registry = RunRegistry::default();
        let directory = Path::new("/tmp/polychat-run");
        let guard = registry.acquire_directory(directory, "run-1").unwrap();
        assert!(registry.acquire_directory(directory, "run-2").is_none());
        registry.cancel("run-1");
        drop(guard);
        assert!(!registry.is_cancelled("run-1"));
        assert!(registry.acquire_directory(directory, "run-2").is_some());
    }

    #[test]
    fn reports_only_the_run_that_was_cancelled() {
        let registry = RunRegistry::default();

        registry.begin("run-1");
        registry.begin("run-2");
        registry.cancel("run-1");

        assert!(registry.is_cancelled("run-1"));
        assert!(!registry.is_cancelled("run-2"));
    }

    #[test]
    fn stops_reporting_a_run_once_it_is_forgotten() {
        let registry = RunRegistry::default();

        registry.begin("run-1");
        registry.cancel("run-1");
        registry.forget("run-1");

        assert!(!registry.is_cancelled("run-1"));
    }

    #[test]
    fn ignores_a_cancellation_for_a_run_that_is_not_under_way() {
        let registry = RunRegistry::default();

        registry.cancel("never-started");

        assert!(!registry.is_cancelled("never-started"));
    }

    #[test]
    fn does_not_let_a_late_cancellation_affect_the_next_run_of_the_same_name() {
        let registry = RunRegistry::default();

        registry.begin("run-1");
        registry.forget("run-1");
        registry.cancel("run-1");
        registry.begin("run-1");

        assert!(!registry.is_cancelled("run-1"));
    }
}
