use std::{env, fs, path::PathBuf};

fn main() {
  let build_number_path = PathBuf::from("..").join("build").join("build-number.txt");
  println!("cargo:rerun-if-changed={}", build_number_path.display());

  let build_number = fs::read_to_string(&build_number_path)
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| "0".to_string());

  println!("cargo:rustc-env=PHOTOBOOTH_BUILD_NUMBER={build_number}");
  println!("cargo:rustc-env=PHOTOBOOTH_DISPLAY_VERSION={}.0_{}", env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "1.0.0".to_string()), build_number);

  tauri_build::build()
}
