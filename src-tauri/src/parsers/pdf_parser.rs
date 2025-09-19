use crate::{Document, Chapter};
use lopdf::Document as PdfDocument;
use std::path::PathBuf;
use uuid::Uuid;

pub async fn parse_pdf(file_path: &PathBuf) -> Result<Document, String> {
    let doc = PdfDocument::load(file_path).map_err(|e| format!("Failed to open PDF: {}", e))?;

    let title = extract_pdf_title(&doc);
    let author = extract_pdf_author(&doc);

    // Extract text from all pages
    let mut content = String::new();
    let page_count = doc.get_pages().len();

    for (page_id, _) in doc.get_pages() {
        if let Ok(text) = doc.extract_text(&[page_id]) {
            content.push_str(&text);
            content.push_str("\n\n");
        }
    }

    // Clean up the content
    content = content
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(Document {
        id: Uuid::new_v4().to_string(),
        title,
        author,
        file_path: file_path.clone(),
        file_type: "pdf".to_string(),
        content,
        current_position: 0,
        total_pages: page_count,
        chapters: Vec::new(), // PDF chapter extraction can be added later
        cover_image: None, // PDF cover extraction can be added later
    })
}

fn extract_pdf_title(doc: &PdfDocument) -> String {
    if let Ok(info) = doc.trailer.get(b"Info") {
        if let Ok(info_dict) = doc.get_dictionary(info.as_reference().unwrap()) {
            if let Ok(title_obj) = info_dict.get(b"Title") {
                if let Ok(title_str) = title_obj.as_str() {
                    return String::from_utf8_lossy(title_str).to_string();
                }
            }
        }
    }
    "Unknown Title".to_string()
}

fn extract_pdf_author(doc: &PdfDocument) -> Option<String> {
    if let Ok(info) = doc.trailer.get(b"Info") {
        if let Ok(info_dict) = doc.get_dictionary(info.as_reference().unwrap()) {
            if let Ok(author_obj) = info_dict.get(b"Author") {
                if let Ok(author_str) = author_obj.as_str() {
                    return Some(String::from_utf8_lossy(author_str).to_string());
                }
            }
        }
    }
    None
}
