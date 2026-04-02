use chrono::{Local, TimeZone};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
  env,
  fs::{self, OpenOptions},
  io,
  io::Write,
  path::{Path, PathBuf},
  process::Command,
  thread,
  time::Duration,
  time::UNIX_EPOCH,
};
use tauri::{
  AppHandle, Listener, LogicalSize, Manager, Monitor, PhysicalPosition, Position, Size, WebviewUrl, WebviewWindow,
  WebviewWindowBuilder,
};
use url::Url;

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
  created_at_text: String,
  video_count: usize,
  total_size_bytes: u64,
  order_id: String,
  client_name: String,
  project_date: String,
  project_status: String,
  phone: String,
  email: String,
  address: String,
  notes: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppVersionInfo {
  version: String,
  build_number: String,
  display_version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MonitorInfo {
  id: String,
  name: String,
  is_primary: bool,
  width: u32,
  height: u32,
  position_x: i32,
  position_y: i32,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectMetadata {
  order_id: String,
  client_name: String,
  project_date: String,
  project_status: String,
  phone: String,
  email: String,
  address: String,
  notes: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActiveSlideshow {
  pid: u32,
  project_path: String,
}

fn default_project_metadata() -> ProjectMetadata {
  ProjectMetadata {
    order_id: String::new(),
    client_name: String::new(),
    project_date: String::new(),
    project_status: "New".to_string(),
    phone: String::new(),
    email: String::new(),
    address: String::new(),
    notes: String::new(),
  }
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

fn get_app_data_root_directory_path() -> Result<PathBuf, String> {
  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    return Ok(PathBuf::from(local_app_data).join("Photobooth").join("Data"));
  }

  env::current_dir()
    .map(|path| path.join("Photobooth").join("Data"))
    .map_err(|error| error.to_string())
}

fn get_app_database_directory_path() -> Result<PathBuf, String> {
  get_app_data_root_directory_path().map(|path| path.join("Database"))
}

fn get_app_log_path() -> Result<PathBuf, String> {
  get_app_data_root_directory_path().map(|path| path.join("Logs").join("photobooth.log"))
}

fn get_project_registry_path() -> Result<PathBuf, String> {
  get_app_database_directory_path().map(|path| path.join("projects.json"))
}

fn get_legacy_project_registry_path() -> Result<PathBuf, String> {
  get_app_data_root_directory_path().map(|path| path.join("projects.json"))
}

fn get_active_slideshows_path() -> Result<PathBuf, String> {
  get_app_database_directory_path().map(|path| path.join("active-slideshows.json"))
}

fn get_app_lock_path() -> Result<PathBuf, String> {
  get_app_database_directory_path().map(|path| path.join("photobooth.lock"))
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

fn format_timestamp_for_display(timestamp_ms: u128) -> String {
  if timestamp_ms == 0 {
    return String::new();
  }

  match Local.timestamp_millis_opt(timestamp_ms as i64).single() {
    Some(timestamp) => timestamp.format("%d%m%Y%H%M%S").to_string(),
    None => String::new(),
  }
}

fn is_sharing_violation(error: &io::Error) -> bool {
  matches!(error.raw_os_error(), Some(32 | 33))
}

fn read_text_file_with_retry(path: &Path) -> Result<String, String> {
  let mut last_error = None;

  for attempt in 0..4 {
    match fs::read_to_string(path) {
      Ok(text) => return Ok(text),
      Err(error) if is_sharing_violation(&error) && attempt < 3 => {
        last_error = Some(error.to_string());
        thread::sleep(Duration::from_millis(120));
      }
      Err(error) => return Err(error.to_string()),
    }
  }

  Err(last_error.unwrap_or_else(|| "Photobooth could not read the file.".to_string()))
}

fn write_text_file_atomic(path: &Path, text: &str) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }

  let temp_path = path.with_extension(format!(
    "{}.tmp",
    path.extension().and_then(|value| value.to_str()).unwrap_or("json")
  ));

  let mut last_error = None;
  for attempt in 0..4 {
    match fs::write(&temp_path, text) {
      Ok(_) => match fs::rename(&temp_path, path) {
        Ok(_) => return Ok(()),
        Err(error) if is_sharing_violation(&error) && attempt < 3 => {
          last_error = Some(error.to_string());
          thread::sleep(Duration::from_millis(120));
        }
        Err(error) => {
          let _ = fs::remove_file(&temp_path);
          return Err(error.to_string());
        }
      },
      Err(error) if is_sharing_violation(&error) && attempt < 3 => {
        last_error = Some(error.to_string());
        thread::sleep(Duration::from_millis(120));
      }
      Err(error) => return Err(error.to_string()),
    }
  }

  let _ = fs::remove_file(&temp_path);
  Err(last_error.unwrap_or_else(|| "Photobooth could not write the file.".to_string()))
}

fn parse_project_metadata(raw_entry: &Value) -> ProjectMetadata {
  let metadata = raw_entry.get("metadata").and_then(Value::as_object);
  let get_value = |camel_key: &str, snake_key: &str| -> String {
    metadata
      .and_then(|value| value.get(camel_key).or_else(|| value.get(snake_key)))
      .and_then(Value::as_str)
      .unwrap_or_else(|| raw_entry.get(camel_key).or_else(|| raw_entry.get(snake_key)).and_then(Value::as_str).unwrap_or(""))
      .trim()
      .to_string()
  };

  ProjectMetadata {
    order_id: get_value("orderId", "order_id"),
    client_name: get_value("clientName", "client_name"),
    project_date: get_value("projectDate", "project_date"),
    project_status: {
      let value = get_value("projectStatus", "project_status");
      if value.is_empty() { "New".to_string() } else { value }
    },
    phone: get_value("phone", "phone"),
    email: get_value("email", "email"),
    address: get_value("address", "address"),
    notes: get_value("notes", "notes"),
  }
}

fn read_project_registry() -> Result<Vec<SavedProject>, String> {
  let registry_path = get_project_registry_path()?;
  let legacy_registry_path = get_legacy_project_registry_path()?;
  let source_path = if registry_path.exists() {
    registry_path
  } else if legacy_registry_path.exists() {
    legacy_registry_path
  } else {
    return Ok(Vec::new());
  };

  let registry_text = read_text_file_with_retry(&source_path)?;
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
    let created_at_text = raw_entry
      .get("createdAtText")
      .or_else(|| raw_entry.get("created_at_text"))
      .and_then(Value::as_str)
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
      .unwrap_or_else(|| format_timestamp_for_display(created_at));
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
    let metadata = parse_project_metadata(&raw_entry);

    projects.push(SavedProject {
      name,
      path,
      created_at,
      created_at_text,
      video_count,
      total_size_bytes,
      order_id: metadata.order_id,
      client_name: metadata.client_name,
      project_date: metadata.project_date,
      project_status: metadata.project_status,
      phone: metadata.phone,
      email: metadata.email,
      address: metadata.address,
      notes: metadata.notes,
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
  write_text_file_atomic(&registry_path, &payload)
}

fn collect_running_process_ids(image_name: &str) -> Option<std::collections::HashSet<u32>> {
  let output = Command::new("tasklist")
    .args(["/FO", "CSV", "/NH", "/FI", &format!("IMAGENAME eq {image_name}")])
    .output()
    .ok()?;
  let stdout = String::from_utf8(output.stdout).ok()?;
  let mut running_ids = std::collections::HashSet::new();

  for line in stdout.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with("INFO:")) {
    let trimmed = line.trim_matches('"');
    let columns = trimmed.split("\",\"").collect::<Vec<_>>();
    if let Some(pid_column) = columns.get(1) {
      if let Ok(pid) = pid_column.trim().parse::<u32>() {
        running_ids.insert(pid);
      }
    }
  }

  Some(running_ids)
}

fn read_active_slideshows() -> Result<Vec<ActiveSlideshow>, String> {
  let path = get_active_slideshows_path()?;
  if !path.exists() {
    return Ok(Vec::new());
  }

  let text = read_text_file_with_retry(&path)?;
  if text.trim().is_empty() {
    return Ok(Vec::new());
  }

  let entries = serde_json::from_str::<Vec<ActiveSlideshow>>(&text).map_err(|error| error.to_string())?;
  let running_ids = collect_running_process_ids("photobooth.exe");
  let active_entries = entries
    .into_iter()
    .filter(|entry| {
      running_ids
        .as_ref()
        .map(|ids| ids.contains(&entry.pid))
        .unwrap_or(true)
    })
    .collect::<Vec<_>>();
  if active_entries.len() > 0 || !text.trim().is_empty() {
    let _ = write_active_slideshows(&active_entries);
  }
  Ok(active_entries)
}

fn write_active_slideshows(entries: &[ActiveSlideshow]) -> Result<(), String> {
  let path = get_active_slideshows_path()?;
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }

  let payload = serde_json::to_string_pretty(entries).map_err(|error| error.to_string())?;
  write_text_file_atomic(&path, &payload)
}

fn read_legacy_project_metadata(project_path: &Path) -> Result<Option<ProjectMetadata>, String> {
  let project_path_string = project_path.to_string_lossy().trim().trim_end_matches(['\\', '/']).to_string();
  if project_path_string.is_empty() {
    return Ok(None);
  }

  let mut candidates = vec![
    PathBuf::from(format!("{project_path_string}\\project.json")),
    PathBuf::from(format!("{project_path_string}\\booking.json")),
  ];

  if let Ok(database_directory) = get_app_database_directory_path() {
    let project_directory_name = project_path_string
      .replace(['<', '>', ':', '"', '/', '\\', '|', '?', '*'], "_")
      .split_whitespace()
      .collect::<Vec<_>>()
      .join(" ");
    candidates.push(database_directory.join("Projects").join(&project_directory_name).join("project.json"));
    candidates.push(database_directory.join("Projects").join(project_directory_name).join("booking.json"));
  }

  for candidate in candidates {
    if !candidate.exists() {
      continue;
    }

    let text = fs::read_to_string(&candidate).map_err(|error| error.to_string())?;
    if text.trim().is_empty() {
      continue;
    }

    let raw_entry = serde_json::from_str::<Value>(&text).map_err(|error| error.to_string())?;
    let metadata = parse_project_metadata(&raw_entry);
    if candidate.starts_with(project_path) {
      let _ = fs::remove_file(&candidate);
    }
    return Ok(Some(metadata));
  }

  Ok(None)
}

fn get_or_migrate_project_metadata(project_path: &str) -> Result<ProjectMetadata, String> {
  let project_path_buf = PathBuf::from(project_path);
  let mut projects = read_project_registry()?;
  if let Some(project) = projects.iter_mut().find(|entry| entry.path.eq_ignore_ascii_case(project_path)) {
    let metadata = ProjectMetadata {
      order_id: project.order_id.clone(),
      client_name: project.client_name.clone(),
      project_date: project.project_date.clone(),
      project_status: if project.project_status.trim().is_empty() { "New".to_string() } else { project.project_status.clone() },
      phone: project.phone.clone(),
      email: project.email.clone(),
      address: project.address.clone(),
      notes: project.notes.clone(),
    };

    let has_metadata = [
      &metadata.order_id,
      &metadata.client_name,
      &metadata.project_date,
      &metadata.phone,
      &metadata.email,
      &metadata.address,
      &metadata.notes,
    ]
    .iter()
    .any(|value| !value.trim().is_empty());

    if has_metadata {
      return Ok(metadata);
    }

    if let Some(legacy_metadata) = read_legacy_project_metadata(&project_path_buf)? {
      project.order_id = legacy_metadata.order_id.clone();
      project.client_name = legacy_metadata.client_name.clone();
      project.project_date = legacy_metadata.project_date.clone();
      project.project_status = legacy_metadata.project_status.clone();
      project.phone = legacy_metadata.phone.clone();
      project.email = legacy_metadata.email.clone();
      project.address = legacy_metadata.address.clone();
      project.notes = legacy_metadata.notes.clone();
      write_project_registry(&projects)?;
      return Ok(legacy_metadata);
    }

    return Ok(metadata);
  }

  if let Some(legacy_metadata) = read_legacy_project_metadata(&project_path_buf)? {
    return Ok(legacy_metadata);
  }

  Ok(default_project_metadata())
}

fn save_project_metadata_for_path(project_path: &str, metadata: ProjectMetadata) -> Result<(), String> {
  let mut projects = read_project_registry()?;
  let project = projects
    .iter_mut()
    .find(|entry| entry.path.eq_ignore_ascii_case(project_path))
    .ok_or_else(|| "Photobooth could not find the selected project folder.".to_string())?;
  project.order_id = metadata.order_id;
  project.client_name = metadata.client_name;
  project.project_date = metadata.project_date;
  project.project_status = metadata.project_status;
  project.phone = metadata.phone;
  project.email = metadata.email;
  project.address = metadata.address;
  project.notes = metadata.notes;
  write_project_registry(&projects)
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
    let metadata = default_project_metadata();
    projects.push(SavedProject {
      name: project_name.to_string(),
      path: project_path_string,
      created_at,
      created_at_text: format_timestamp_for_display(created_at),
      video_count,
      total_size_bytes,
      order_id: metadata.order_id,
      client_name: metadata.client_name,
      project_date: metadata.project_date,
      project_status: metadata.project_status,
      phone: metadata.phone,
      email: metadata.email,
      address: metadata.address,
      notes: metadata.notes,
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
        created_at_text: format_timestamp_for_display(get_path_created_at(&path)),
        video_count: 0,
        total_size_bytes: 0,
        order_id: String::new(),
        client_name: String::new(),
        project_date: String::new(),
        project_status: "New".to_string(),
        phone: String::new(),
        email: String::new(),
        address: String::new(),
        notes: String::new(),
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
    if project.created_at_text.trim().is_empty() {
      project.created_at_text = format_timestamp_for_display(project.created_at);
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
    .fullscreen(label == "main")
    .build()
    .map(|_| ())
    .map_err(|error| error.to_string())
}

fn recreate_window(
  app: &AppHandle,
  label: &str,
  title: &str,
  page: &str,
  width: f64,
  height: f64,
) -> Result<(), String> {
  if let Some(window) = app.get_webview_window(label) {
    window.close().map_err(|error| error.to_string())?;
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

fn is_external_slideshow_process() -> bool {
  env::args().any(|argument| argument == "--external-slideshow")
}

fn get_external_slideshow_project_path() -> Option<String> {
  let mut args = env::args();
  while let Some(argument) = args.next() {
    if argument == "--slideshow-project" {
      return args.next();
    }
  }
  None
}

fn build_monitor_id(monitor: &Monitor, index: usize) -> String {
  let name = monitor
    .name()
    .cloned()
    .unwrap_or_else(|| format!("Monitor {}", index + 1));
  let position = monitor.position();
  let size = monitor.size();
  format!(
    "{}|{}|{}|{}|{}",
    name,
    position.x,
    position.y,
    size.width,
    size.height
  )
}

fn get_monitor_infos(window: &WebviewWindow) -> Result<Vec<MonitorInfo>, String> {
  let primary_id = window
    .primary_monitor()
    .map_err(|error| error.to_string())?
    .map(|monitor| build_monitor_id(&monitor, 0))
    .unwrap_or_default();

  let monitors = window.available_monitors().map_err(|error| error.to_string())?;
  Ok(
    monitors
      .into_iter()
      .enumerate()
      .map(|(index, monitor)| {
        let id = build_monitor_id(&monitor, index);
        let name = monitor
          .name()
          .cloned()
          .unwrap_or_else(|| format!("Monitor {}", index + 1));
        let size = monitor.size();
        let position = monitor.position();
        MonitorInfo {
          is_primary: id == primary_id,
          id,
          name,
          width: size.width,
          height: size.height,
          position_x: position.x,
          position_y: position.y,
        }
      })
      .collect(),
  )
}

fn find_monitor_by_id(window: &WebviewWindow, monitor_id: &str) -> Result<Option<Monitor>, String> {
  let monitors = window.available_monitors().map_err(|error| error.to_string())?;
  Ok(
    monitors
      .into_iter()
      .enumerate()
      .find_map(|(index, monitor)| (build_monitor_id(&monitor, index) == monitor_id).then_some(monitor)),
  )
}

fn clamp_windowed_size(monitor: &Monitor) -> (f64, f64) {
  let size = monitor.size();
  let width = ((size.width as f64) * 0.82).round().clamp(960.0, 1600.0);
  let height = ((size.height as f64) * 0.82).round().clamp(720.0, 1200.0);
  (width, height)
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
fn write_text_file(file_path: String, text: String) -> Result<(), String> {
  let path = PathBuf::from(file_path);
  write_text_file_atomic(&path, &text)
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
fn get_app_data_directory() -> Result<String, String> {
  get_app_database_directory_path().map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn list_available_monitors(window: WebviewWindow) -> Result<Vec<MonitorInfo>, String> {
  get_monitor_infos(&window)
}

#[tauri::command]
fn apply_current_window_settings(window: WebviewWindow, monitor_id: Option<String>, fullscreen: bool) -> Result<(), String> {
  if !fullscreen {
    window.set_fullscreen(false).map_err(|error| error.to_string())?;
  }

  if let Some(target_monitor_id) = monitor_id.as_deref().filter(|value| !value.trim().is_empty()) {
    if let Some(monitor) = find_monitor_by_id(&window, target_monitor_id)? {
      let position = monitor.position();
      if fullscreen {
        window
          .set_position(Position::Physical(PhysicalPosition::new(position.x, position.y)))
          .map_err(|error| error.to_string())?;
      } else {
        let (width, height) = clamp_windowed_size(&monitor);
        let position_x = position.x + 48;
        let position_y = position.y + 48;
        window
          .set_size(Size::Logical(LogicalSize::new(width, height)))
          .map_err(|error| error.to_string())?;
        window
          .set_position(Position::Physical(PhysicalPosition::new(position_x, position_y)))
          .map_err(|error| error.to_string())?;
      }
    }
  }

  window.set_fullscreen(fullscreen).map_err(|error| error.to_string())?;
  window.show().map_err(|error| error.to_string())?;
  window.unminimize().map_err(|error| error.to_string())?;
  window.set_focus().map_err(|error| error.to_string())?;
  Ok(())
}

#[tauri::command]
fn get_project_metadata(project_path: String) -> Result<ProjectMetadata, String> {
  get_or_migrate_project_metadata(&project_path)
}

#[tauri::command]
fn save_project_metadata(project_path: String, metadata: ProjectMetadata) -> Result<(), String> {
  save_project_metadata_for_path(&project_path, metadata)
}

#[tauri::command]
fn list_active_slideshows() -> Result<Vec<ActiveSlideshow>, String> {
  read_active_slideshows()
}

#[tauri::command]
fn close_external_slideshows(project_path: Option<String>) -> Result<(), String> {
  let slideshows = read_active_slideshows()?;
  let normalized_project_path = project_path.unwrap_or_default();
  let close_all = normalized_project_path.trim().is_empty();
  let mut remaining = Vec::new();

  for slideshow in slideshows {
    let matches_project = close_all || slideshow.project_path.eq_ignore_ascii_case(&normalized_project_path);
    if matches_project {
      let _ = Command::new("taskkill")
        .args(["/PID", &slideshow.pid.to_string(), "/T", "/F"])
        .spawn();
    } else {
      remaining.push(slideshow);
    }
  }

  write_active_slideshows(&remaining)
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
fn read_text_file(file_path: String) -> Result<String, String> {
  let path = PathBuf::from(file_path);
  if !path.exists() {
    return Ok(String::new());
  }

  read_text_file_with_retry(&path)
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
  recreate_window(&app, "slideshow", "Photobooth Slideshow", "slideshow.html", 1440.0, 900.0)
}

#[tauri::command]
fn open_slideshow_process(project_path: String) -> Result<(), String> {
  let executable_path = env::current_exe().map_err(|error| error.to_string())?;
  Command::new(executable_path)
    .arg("--external-slideshow")
    .arg("--slideshow-project")
    .arg(project_path)
    .env_remove("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS")
    .spawn()
    .map(|_| ())
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_gallery_window(app: AppHandle) -> Result<(), String> {
  show_or_create_window(&app, "gallery", "Photobooth Library", "gallery.html", 1320.0, 860.0)
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
  app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let run_external_slideshow = is_external_slideshow_process();
  let external_slideshow_project_path = get_external_slideshow_project_path().unwrap_or_default();
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if !run_external_slideshow {
        let lock_path = get_app_lock_path()?;
        let lock_payload = serde_json::json!({
          "pid": std::process::id(),
          "startedAt": Local::now().format("%d%m%Y%H%M%S").to_string(),
          "mode": "main-app"
        });
        write_text_file_atomic(&lock_path, &lock_payload.to_string())?;
      }

      if run_external_slideshow {
        let current_pid = std::process::id();
        let mut slideshows = read_active_slideshows().unwrap_or_default();
        slideshows.retain(|entry| entry.pid != current_pid);
        slideshows.push(ActiveSlideshow {
          pid: current_pid,
          project_path: external_slideshow_project_path.clone(),
        });
        let _ = write_active_slideshows(&slideshows);

        let main_window = app
          .get_webview_window("main")
          .ok_or_else(|| "Photobooth could not find the external slideshow window.".to_string())?;
        main_window
          .set_title("Photobooth Slideshow")
          .map_err(|error| error.to_string())?;
        main_window
          .set_fullscreen(false)
          .map_err(|error| error.to_string())?;
        let slideshow_url = if external_slideshow_project_path.trim().is_empty() {
          "http://tauri.localhost/slideshow.html".to_string()
        } else {
          format!(
            "http://tauri.localhost/slideshow.html?project={}",
            urlencoding::encode(&external_slideshow_project_path)
          )
        };
        main_window
          .navigate(Url::parse(&slideshow_url).map_err(|error| error.to_string())?)
          .map_err(|error| error.to_string())?;
        let project_path = external_slideshow_project_path.clone();
        app.handle().listen("tauri://destroyed", move |_| {
          let current_pid = std::process::id();
          let mut slideshows = read_active_slideshows().unwrap_or_default();
          slideshows.retain(|entry| !(entry.pid == current_pid && entry.project_path.eq_ignore_ascii_case(&project_path)));
          let _ = write_active_slideshows(&slideshows);
        });
      } else {
        app.handle().listen("tauri://destroyed", move |_| {
          if let Ok(lock_path) = get_app_lock_path() {
            let _ = fs::remove_file(lock_path);
          }
        });
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      write_binary_file,
      write_text_file,
      save_recording_to_directory,
      save_recording_to_default_directory,
      get_default_recordings_directory,
      get_app_data_directory,
      list_available_monitors,
      apply_current_window_settings,
      get_project_metadata,
      save_project_metadata,
      list_active_slideshows,
      close_external_slideshows,
      create_project_directory,
      list_saved_projects,
      rename_project_directory,
      delete_project_directory,
      delete_recording_file,
      read_recording_file,
      read_text_file,
      list_saved_recordings,
      get_app_version,
      append_app_log,
      open_slideshow_window,
      open_slideshow_process,
      open_gallery_window,
      open_directory_in_file_manager,
      exit_app
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

