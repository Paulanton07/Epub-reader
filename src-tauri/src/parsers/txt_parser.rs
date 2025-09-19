use crate::{Document, Chapter};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

pub async fn parse_txt(file_path: &PathBuf) -> Result<Document, String> {
    let content =
        fs::read_to_string(file_path).map_err(|e| format!("Failed to read text file: {}", e))?;

    // Extract title from filename
    let title = file_path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Unknown Title")
        .to_string();

    // For text files, we don't have author information
    let author = None;

    // Estimate pages (rough calculation: ~500 words per page)
    let word_count = content.split_whitespace().count();
    let estimated_pages = (word_count / 500).max(1);

    Ok(Document {
        id: Uuid::new_v4().to_string(),
        title,
        author,
        file_path: file_path.clone(),
        file_type: "txt".to_string(),
        content,
        current_position: 0,
        total_pages: estimated_pages,
        chapters: Vec::new(), // TXT files don't have chapters by default
        cover_image: None, // TXT files don't have cover images
    })
}
