use serde::Serialize;
use std::{env, fs, path::PathBuf};

#[derive(Serialize)]
struct SavedRecording {
  filename: String,
  path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppVersionInfo {
  version: String,
  build_number: String,
  display_version: String,
}

fn is_supported_video_file(path: &PathBuf) -> bool {
  path
    .extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "mp4" | "webm" | "mov" | "m4v" | "ogg"))
    .unwrap_or(false)
}

#[tauri::command]
fn write_binary_file(file_path: String, bytes: Vec<u8>) -> Result<(), String> {
  let path = PathBuf::from(file_path);

  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }

  fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_recording_to_directory(directory_path: String, file_name: String, bytes: Vec<u8>) -> Result<String, String> {
  let mut path = PathBuf::from(directory_path);
  fs::create_dir_all(&path).map_err(|error| error.to_string())?;
  path.push(file_name);
  fs::write(&path, bytes).map_err(|error| error.to_string())?;
  Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn list_saved_recordings(directory_path: String) -> Result<Vec<SavedRecording>, String> {
  let directory = PathBuf::from(directory_path);
  if !directory.exists() {
    return Ok(Vec::new());
  }

  let mut recordings = Vec::new();
  for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let path = entry.path();
    if !path.is_file() || !is_supported_video_file(&path) {
      continue;
    }

    let filename = entry.file_name().to_string_lossy().into_owned();
    recordings.push(SavedRecording {
      filename,
      path: path.to_string_lossy().into_owned(),
    });
  }

  recordings.sort_by(|left, right| left.filename.cmp(&right.filename));
  Ok(recordings)
}

#[tauri::command]
fn get_app_version() -> AppVersionInfo {
  AppVersionInfo {
    version: env!("CARGO_PKG_VERSION").to_string(),
    build_number: env!("PHOTOBOOTH_BUILD_NUMBER").to_string(),
    display_version: env!("PHOTOBOOTH_DISPLAY_VERSION").to_string(),
  }
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
  app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      write_binary_file,
      save_recording_to_directory,
      list_saved_recordings,
      get_app_version,
      exit_app
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
