use chrono::Local;
use serde::Serialize;
use serde_json::Value;
use std::{
  env,
  fs::{self, OpenOptions},
  io::Write,
  path::{Path, PathBuf},
  process::Command,
  time::UNIX_EPOCH,
};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedRecording {
  filename: String,
  path: String,
  modified_at: u128,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedProject {
  name: String,
  path: String,
  created_at: u128,
  video_count: usize,
  total_size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppVersionInfo {
  version: String,
  build_number: String,
  display_version: String,
}

fn is_supported_video_file(path: &Path) -> bool {
  path
    .extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "mp4" | "webm" | "mov" | "m4v" | "ogg"))
    .unwrap_or(false)
}

fn get_default_recordings_directory_path() -> Result<PathBuf, String> {
  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    return Ok(PathBuf::from(local_app_data).join("Photobooth").join("Recordings"));
  }

  env::current_dir()
    .map(|path| path.join("Photobooth").join("Recordings"))
    .map_err(|error| error.to_string())
}

fn get_app_log_path() -> Result<PathBuf, String> {
  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    return Ok(PathBuf::from(local_app_data).join("Photobooth").join("Logs").join("photobooth.log"));
  }

  env::current_dir()
    .map(|path| path.join("Photobooth").join("Logs").join("photobooth.log"))
    .map_err(|error| error.to_string())
}

fn get_project_registry_path() -> Result<PathBuf, String> {
  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    return Ok(PathBuf::from(local_app_data).join("Photobooth").join("Data").join("projects.json"));
  }

  env::current_dir()
    .map(|path| path.join("Photobooth").join("Data").join("projects.json"))
    .map_err(|error| error.to_string())
}

fn sanitize_log_text(value: &str) -> String {
  value
    .replace('\r', " ")
    .replace('\n', " ")
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
}

fn normalize_project_name(project_name: &str) -> String {
  project_name.trim().to_string()
}

fn is_valid_project_name(project_name: &str) -> bool {
  !project_name.is_empty()
    && project_name.chars().all(|character| {
      character.is_ascii_alphanumeric() || matches!(character, ' ' | '.' | '-')
    })
}

fn compute_directory_metrics(directory: &Path) -> (usize, u64) {
  let mut video_count = 0usize;
  let mut total_size_bytes = 0u64;

  let entries = match fs::read_dir(directory) {
    Ok(entries) => entries,
    Err(_) => return (0, 0),
  };

  for entry in entries.filter_map(Result::ok) {
    let path = entry.path();
    if path.is_dir() {
      let (nested_count, nested_size) = compute_directory_metrics(&path);
      video_count += nested_count;
      total_size_bytes = total_size_bytes.saturating_add(nested_size);
      continue;
    }

    if let Ok(metadata) = entry.metadata() {
      total_size_bytes = total_size_bytes.saturating_add(metadata.len());
    }

    if path.is_file() && is_supported_video_file(&path) {
      video_count += 1;
    }
  }

  (video_count, total_size_bytes)
}

fn get_path_created_at(path: &Path) -> u128 {
  fs::metadata(path)
    .ok()
    .and_then(|metadata| metadata.created().ok().or_else(|| metadata.modified().ok()))
    .and_then(|timestamp| timestamp.duration_since(UNIX_EPOCH).ok())
    .map(|duration| duration.as_millis())
    .unwrap_or(0)
}

fn read_project_registry() -> Result<Vec<SavedProject>, String> {
  let registry_path = get_project_registry_path()?;
  if !registry_path.exists() {
    return Ok(Vec::new());
  }

  let registry_text = fs::read_to_string(registry_path).map_err(|error| error.to_string())?;
  if registry_text.trim().is_empty() {
    return Ok(Vec::new());
  }

  let raw_entries = serde_json::from_str::<Vec<Value>>(&registry_text).map_err(|error| error.to_string())?;
  let mut projects = Vec::new();
  for raw_entry in raw_entries {
    let name = raw_entry.get("name").and_then(Value::as_str).unwrap_or("").trim().to_string();
    let path = raw_entry.get("path").and_then(Value::as_str).unwrap_or("").trim().to_string();
    if name.is_empty() || path.is_empty() {
      continue;
    }

    let created_at = raw_entry
      .get("createdAt")
      .or_else(|| raw_entry.get("created_at"))
      .and_then(Value::as_u64)
      .map(u128::from)
      .unwrap_or_else(|| get_path_created_at(Path::new(&path)));
    let video_count = raw_entry
      .get("videoCount")
      .or_else(|| raw_entry.get("video_count"))
      .and_then(Value::as_u64)
      .map(|value| value as usize)
      .unwrap_or(0);
    let total_size_bytes = raw_entry
      .get("totalSizeBytes")
      .or_else(|| raw_entry.get("total_size_bytes"))
      .and_then(Value::as_u64)
      .unwrap_or(0);

    projects.push(SavedProject {
      name,
      path,
      created_at,
      video_count,
      total_size_bytes,
    });
  }

  Ok(projects)
}

fn write_project_registry(projects: &[SavedProject]) -> Result<(), String> {
  let registry_path = get_project_registry_path()?;
  if let Some(parent) = registry_path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }

  let payload = serde_json::to_string_pretty(projects).map_err(|error| error.to_string())?;
  fs::write(registry_path, payload).map_err(|error| error.to_string())
}

fn upsert_project_registry_entry(project_path: &Path, project_name: &str) -> Result<(), String> {
  let project_path_string = project_path.to_string_lossy().into_owned();
  let mut projects = read_project_registry()?;
  let created_at = get_path_created_at(project_path);
  let (video_count, total_size_bytes) = compute_directory_metrics(project_path);

  if let Some(existing_project) = projects.iter_mut().find(|project| project.path.eq_ignore_ascii_case(&project_path_string)) {
    existing_project.name = project_name.to_string();
    existing_project.created_at = if existing_project.created_at > 0 { existing_project.created_at } else { created_at };
    existing_project.video_count = video_count;
    existing_project.total_size_bytes = total_size_bytes;
  } else {
    projects.push(SavedProject {
      name: project_name.to_string(),
      path: project_path_string,
      created_at,
      video_count,
      total_size_bytes,
    });
  }

  write_project_registry(&projects)
}

fn remove_project_registry_entry(project_path: &Path) -> Result<(), String> {
  let project_path_string = project_path.to_string_lossy().into_owned();
  let mut projects = read_project_registry()?;
  projects.retain(|project| !project.path.eq_ignore_ascii_case(&project_path_string));
  write_project_registry(&projects)
}

fn build_saved_projects() -> Result<Vec<SavedProject>, String> {
  let mut projects = read_project_registry()?;
  let default_directory = get_default_recordings_directory_path()?;

  if default_directory.exists() {
    for entry in fs::read_dir(&default_directory).map_err(|error| error.to_string())? {
      let entry = entry.map_err(|error| error.to_string())?;
      let path = entry.path();
      if !path.is_dir() {
        continue;
      }

      let path_string = path.to_string_lossy().into_owned();
      if projects.iter().any(|project| project.path.eq_ignore_ascii_case(&path_string)) {
        continue;
      }

      let fallback_name = entry.file_name().to_string_lossy().into_owned();
      projects.push(SavedProject {
        name: fallback_name,
        path: path_string,
        created_at: get_path_created_at(&path),
        video_count: 0,
        total_size_bytes: 0,
      });
    }
  }

  projects.retain(|project| Path::new(&project.path).exists());
  projects.iter_mut().for_each(|project| {
    let path = PathBuf::from(&project.path);
    if path.exists() {
      let (video_count, total_size_bytes) = compute_directory_metrics(&path);
      project.video_count = video_count;
      project.total_size_bytes = total_size_bytes;
    } else {
      project.video_count = 0;
      project.total_size_bytes = 0;
    }
    if project.created_at == 0 {
      project.created_at = get_path_created_at(&path);
    }
  });

  projects.sort_by(|left, right| {
    right
      .created_at
      .cmp(&left.created_at)
      .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
  });
  write_project_registry(&projects)?;
  Ok(projects)
}

fn show_or_create_window(
  app: &AppHandle,
  label: &str,
  title: &str,
  page: &str,
  width: f64,
  height: f64,
) -> Result<(), String> {
  if let Some(window) = app.get_webview_window(label) {
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    return Ok(());
  }

  WebviewWindowBuilder::new(app, label, WebviewUrl::App(page.into()))
    .title(title)
    .inner_size(width, height)
    .resizable(true)
    .fullscreen(false)
    .build()
    .map(|_| ())
    .map_err(|error| error.to_string())
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
fn save_recording_to_default_directory(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
  let directory_path = get_default_recordings_directory_path()?;
  save_recording_to_directory(directory_path.to_string_lossy().into_owned(), file_name, bytes)
}

#[tauri::command]
fn get_default_recordings_directory() -> Result<String, String> {
  get_default_recordings_directory_path().map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn create_project_directory(project_name: String, parent_directory: String) -> Result<String, String> {
  let normalized_name = normalize_project_name(&project_name);
  if normalized_name.is_empty() {
    return Err("Enter a project name to create a new folder.".to_string());
  }

  if !is_valid_project_name(&normalized_name) {
    return Err("Use only letters, numbers, spaces, periods, and hyphens in the project name.".to_string());
  }

  let base_directory = if parent_directory.trim().is_empty() {
    get_default_recordings_directory_path()?
  } else {
    PathBuf::from(parent_directory)
  };

  fs::create_dir_all(&base_directory).map_err(|error| error.to_string())?;
  let project_directory = Path::new(&base_directory).join(&normalized_name);
  if project_directory.exists() {
    return Err("A project folder with that name already exists. Choose a different name.".to_string());
  }

  fs::create_dir(&project_directory).map_err(|error| error.to_string())?;
  upsert_project_registry_entry(&project_directory, &normalized_name)?;
  Ok(project_directory.to_string_lossy().into_owned())
}

#[tauri::command]
fn list_saved_projects() -> Result<Vec<SavedProject>, String> {
  build_saved_projects()
}

#[tauri::command]
fn rename_project_directory(project_path: String, project_name: String) -> Result<String, String> {
  let normalized_name = normalize_project_name(&project_name);
  if normalized_name.is_empty() {
    return Err("Enter a project name to continue.".to_string());
  }

  if !is_valid_project_name(&normalized_name) {
    return Err("Use only letters, numbers, spaces, periods, and hyphens in the project name.".to_string());
  }

  let current_path = PathBuf::from(project_path);
  if !current_path.exists() || !current_path.is_dir() {
    return Err("Photobooth could not find the selected project folder.".to_string());
  }

  let parent_directory = current_path.parent().ok_or_else(|| "Photobooth could not rename the selected project folder.".to_string())?;
  let renamed_path = parent_directory.join(&normalized_name);
  if renamed_path.exists() && renamed_path != current_path {
    return Err("A project folder with that name already exists. Choose a different name.".to_string());
  }

  fs::rename(&current_path, &renamed_path).map_err(|error| error.to_string())?;
  remove_project_registry_entry(&current_path)?;
  upsert_project_registry_entry(&renamed_path, &normalized_name)?;
  Ok(renamed_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn delete_project_directory(project_path: String) -> Result<(), String> {
  let path = PathBuf::from(project_path);
  if path.exists() {
    fs::remove_dir_all(&path).map_err(|error| error.to_string())?;
  }

  remove_project_registry_entry(&path)
}

#[tauri::command]
fn open_directory_in_file_manager(directory_path: String) -> Result<String, String> {
  let directory = if directory_path.trim().is_empty() {
    get_default_recordings_directory_path()?
  } else {
    PathBuf::from(directory_path)
  };

  fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
  Command::new("explorer")
    .arg(&directory)
    .spawn()
    .map_err(|error| error.to_string())?;
  Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
fn delete_recording_file(file_path: String) -> Result<(), String> {
  let path = PathBuf::from(file_path);
  if !path.exists() {
    return Ok(());
  }

  fs::remove_file(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_recording_file(file_path: String) -> Result<Vec<u8>, String> {
  fs::read(PathBuf::from(file_path)).map_err(|error| error.to_string())
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

    let modified_at = entry
      .metadata()
      .ok()
      .and_then(|metadata| metadata.modified().ok())
      .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
      .map(|duration| duration.as_millis())
      .unwrap_or(0);

    let filename = entry.file_name().to_string_lossy().into_owned();
    recordings.push(SavedRecording {
      filename,
      path: path.to_string_lossy().into_owned(),
      modified_at,
    });
  }

  recordings.sort_by(|left, right| {
    right
      .modified_at
      .cmp(&left.modified_at)
      .then_with(|| right.filename.cmp(&left.filename))
  });
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
fn append_app_log(level: String, message: String, context: Option<String>) -> Result<String, String> {
  let log_path = get_app_log_path()?;
  if let Some(parent) = log_path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }

  let timestamp = Local::now().format("%d/%m/%Y %H:%M:%S:%3f").to_string();
  let normalized_level = sanitize_log_text(&level).to_uppercase();
  let normalized_message = sanitize_log_text(&message);
  let normalized_context = context
    .as_deref()
    .map(sanitize_log_text)
    .filter(|value| !value.is_empty());
  let line = match normalized_context {
    Some(context) => format!("{timestamp} [{normalized_level}] {normalized_message} | {context}\n"),
    None => format!("{timestamp} [{normalized_level}] {normalized_message}\n"),
  };

  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&log_path)
    .map_err(|error| error.to_string())?;
  file.write_all(line.as_bytes()).map_err(|error| error.to_string())?;
  Ok(log_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_slideshow_window(app: AppHandle) -> Result<(), String> {
  show_or_create_window(&app, "slideshow", "Photobooth Slideshow", "slideshow.html", 1440.0, 900.0)
}

#[tauri::command]
fn open_gallery_window(app: AppHandle) -> Result<(), String> {
  show_or_create_window(&app, "gallery", "Photobooth Gallery", "gallery.html", 1320.0, 860.0)
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
      save_recording_to_default_directory,
      get_default_recordings_directory,
      create_project_directory,
      list_saved_projects,
      rename_project_directory,
      delete_project_directory,
      delete_recording_file,
      read_recording_file,
      list_saved_recordings,
      get_app_version,
      append_app_log,
      open_slideshow_window,
      open_gallery_window,
      open_directory_in_file_manager,
      exit_app
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

