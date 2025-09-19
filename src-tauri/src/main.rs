// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod library;
mod parsers;

use chrono::Utc;
use database::{Database, StoredDocument, UserSettings};
use library::Library;
use parsers::{epub_parser, pdf_parser, txt_parser};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{command, State};

// Document content cache
struct DocumentCache {
    documents: Mutex<HashMap<String, Document>>,
}

impl DocumentCache {
    fn new() -> Self {
        Self {
            documents: Mutex::new(HashMap::new()),
        }
    }
    
    fn get(&self, document_id: &str) -> Option<Document> {
        self.documents.lock().unwrap().get(document_id).cloned()
    }
    
    fn set(&self, document_id: String, document: Document) {
        let mut cache = self.documents.lock().unwrap();
        // Limit cache size to prevent memory issues (keep last 5 documents)
        if cache.len() >= 5 {
            if let Some(oldest_key) = cache.keys().next().cloned() {
                cache.remove(&oldest_key);
            }
        }
        cache.insert(document_id, document);
    }
    
    fn clear(&self, document_id: &str) {
        self.documents.lock().unwrap().remove(document_id);
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Chapter {
    pub id: String,
    pub title: String,
    pub start_position: usize,
    pub end_position: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub file_path: PathBuf,
    pub file_type: String,
    pub content: String,
    pub current_position: usize,
    pub total_pages: usize,
    pub chapters: Vec<Chapter>,
    pub cover_image: Option<String>, // Base64 encoded cover image
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReadingProgress {
    pub document_id: String,
    pub position: usize,
    pub percentage: f32,
}

// Tauri commands
#[command]
async fn open_document(file_path: String, db: State<'_, Database>) -> Result<Document, String> {
    let path = PathBuf::from(&file_path);
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or("Invalid file extension")?;

    let document = match extension.to_lowercase().as_str() {
        "epub" => epub_parser::parse_epub(&path).await,
        "pdf" => pdf_parser::parse_pdf(&path).await,
        "txt" => txt_parser::parse_txt(&path).await,
        _ => Err(format!("Unsupported file format: {}", extension)),
    }?;

    // Save document to database
    let stored_doc = StoredDocument {
        id: document.id.clone(),
        title: document.title.clone(),
        author: document.author.clone(),
        file_path: file_path,
        file_type: document.file_type.clone(),
        total_pages: document.total_pages as i32,
        current_position: 0,
        last_read: Utc::now(),
        added_date: Utc::now(),
    };

    db.save_document(&stored_doc)
        .await
        .map_err(|e| format!("Failed to save document: {}", e))?;

    Ok(document)
}

#[command]
async fn get_library(db: State<'_, Database>) -> Result<Vec<StoredDocument>, String> {
    db.get_all_documents()
        .await
        .map_err(|e| format!("Failed to get library: {}", e))
}

#[command]
async fn update_reading_progress(
    document_id: String,
    position: i32,
    db: State<'_, Database>,
) -> Result<(), String> {
    db.update_reading_progress(&document_id, position)
        .await
        .map_err(|e| format!("Failed to update progress: {}", e))
}

#[command]
async fn save_user_settings(settings: UserSettings, db: State<'_, Database>) -> Result<(), String> {
    db.save_settings(&settings)
        .await
        .map_err(|e| format!("Failed to save settings: {}", e))
}

#[command]
async fn get_user_settings(db: State<'_, Database>) -> Result<UserSettings, String> {
    db.get_settings()
        .await
        .map_err(|e| format!("Failed to get settings: {}", e))
}

#[command]
async fn search_in_document(
    document_id: String,
    query: String,
    db: State<'_, Database>,
) -> Result<Vec<(usize, String)>, String> {
    // Get document from database to get file path
    let documents = db.get_all_documents().await
        .map_err(|e| format!("Failed to get documents: {}", e))?;
    
    let stored_doc = documents.iter()
        .find(|doc| doc.id == document_id)
        .ok_or("Document not found")?;
    
    // Load content from file - use direct parsing for search to avoid circular dependency
    let path = PathBuf::from(&stored_doc.file_path);
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or("Invalid file extension")?;

    let document = match extension.to_lowercase().as_str() {
        "epub" => epub_parser::parse_epub(&path).await,
        "pdf" => pdf_parser::parse_pdf(&path).await,
        "txt" => txt_parser::parse_txt(&path).await,
        _ => Err(format!("Unsupported file format: {}", extension)),
    }.map_err(|e| format!("Failed to parse document: {}", e))?;
    
    let content = document.content;
    
    // Search in content
    let mut results = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    
    for (line_num, line) in lines.iter().enumerate() {
        if line.to_lowercase().contains(&query.to_lowercase()) {
            results.push((line_num, line.to_string()));
        }
    }
    
    Ok(results)
}

#[command]
async fn delete_document(document_id: String, db: State<'_, Database>) -> Result<(), String> {
    db.delete_document(&document_id)
        .await
        .map_err(|e| format!("Failed to delete document: {}", e))
}

#[command]
async fn get_document_content(
    file_path: String, 
    cache: State<'_, DocumentCache>,
    db: State<'_, Database>
) -> Result<String, String> {
    // Try to find document ID from file path
    let documents = db.get_all_documents().await
        .map_err(|e| format!("Failed to get documents: {}", e))?;
    
    let document_id = documents.iter()
        .find(|doc| doc.file_path == file_path)
        .map(|doc| doc.id.clone());
    
    // Try cache first if we have a document ID
    if let Some(doc_id) = &document_id {
        if let Some(cached_doc) = cache.get(doc_id) {
            println!("Using cached content for document {}", doc_id);
            return Ok(cached_doc.content);
        }
    }

    let path = PathBuf::from(&file_path);
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or("Invalid file extension")?;

    let document = match extension.to_lowercase().as_str() {
        "epub" => epub_parser::parse_epub(&path).await,
        "pdf" => pdf_parser::parse_pdf(&path).await,
        "txt" => txt_parser::parse_txt(&path).await,
        _ => Err(format!("Unsupported file format: {}", extension)),
    }?;

    // Cache the document if we have an ID
    if let Some(doc_id) = document_id {
        cache.set(doc_id, document.clone());
    }

    Ok(document.content)
}

#[command]
async fn get_chapters(
    document_id: String, 
    db: State<'_, Database>,
    cache: State<'_, DocumentCache>
) -> Result<Vec<Chapter>, String> {
    // First, try memory cache for the full document (fastest)
    if let Some(cached_doc) = cache.get(&document_id) {
        println!("Using memory-cached document for chapters: {}", document_id);
        return Ok(cached_doc.chapters);
    }
    
    // Second, try database cache for chapters only (fast)
    match db.get_cached_chapters(&document_id).await {
        Ok(Some(cached_chapters)) => {
            println!("Using database-cached chapters for document {}", document_id);
            return Ok(cached_chapters);
        }
        Ok(None) => {
            println!("No cached chapters found for document {}, parsing file...", document_id);
        }
        Err(e) => {
            println!("Cache lookup failed: {}, falling back to file parsing", e);
        }
    }
    
    // Get document from database to get file path
    let documents = db.get_all_documents().await
        .map_err(|e| format!("Failed to get documents: {}", e))?;
    
    let stored_doc = documents.iter()
        .find(|doc| doc.id == document_id)
        .ok_or("Document not found")?;
    
    let path = PathBuf::from(&stored_doc.file_path);
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or("Invalid file extension")?;

    println!("Parsing document from file: {:?}", path);
    let document = match extension.to_lowercase().as_str() {
        "epub" => epub_parser::parse_epub(&path).await,
        "pdf" => pdf_parser::parse_pdf(&path).await,
        "txt" => txt_parser::parse_txt(&path).await,
        _ => Err(format!("Unsupported file format: {}", extension)),
    }?;

    // Cache the chapters for future use
    if !document.chapters.is_empty() {
        if let Err(e) = db.save_chapters(&document_id, &document.chapters).await {
            println!("Failed to cache chapters: {}", e);
            // Continue anyway, don't fail the request
        } else {
            println!("Cached {} chapters for document {}", document.chapters.len(), document_id);
        }
    }

    Ok(document.chapters)
}

#[tokio::main]
async fn main() {
    // Configure logging to reduce spam from PDF parsing
    // To enable debug logging, set RUST_LOG=debug environment variable
    // To reduce all logging, set RUST_LOG=error
    use tracing_subscriber::{EnvFilter, fmt};
    
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| {
            // Set default log levels: warn for PDF-related crates, info for our app
            EnvFilter::new("warn,epub_reader=info,lopdf=warn,pdf=warn")
        });
    
    fmt()
        .with_env_filter(filter)
        .init();

    // Initialize database
    let database = Database::new()
        .await
        .expect("Failed to initialize database");

    let library = Library::new();
    let document_cache = DocumentCache::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .manage(database)
        .manage(library)
        .manage(document_cache)
        .invoke_handler(tauri::generate_handler![
            open_document,
            get_library,
            update_reading_progress,
            save_user_settings,
            get_user_settings,
            search_in_document,
            delete_document,
            get_document_content,
            get_chapters
        ])
        .setup(|app| {
            // Ensure API is properly injected
            println!("Tauri app setup completed");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
