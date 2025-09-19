use crate::Document;
use epub::doc::EpubDoc;
use std::path::PathBuf;
use uuid::Uuid;

pub async fn parse_epub(file_path: &PathBuf) -> Result<Document, String> {
    let mut doc = EpubDoc::new(file_path)
        .map_err(|e| format!("Failed to open EPUB: {}", e))?;

    let title = doc.mdata("title").unwrap_or_else(|| "Unknown Title".to_string());
    let author = doc.mdata("creator");
    
    // Extract all text content
    let mut content = String::new();
    let spine_len = doc.get_num_pages();
    
    for i in 0..spine_len {
        if let Ok((chapter_content, _)) = doc.get_resource_str_by_path(&doc.get_resource(i).unwrap().0) {
            // Simple HTML tag removal - in a real app you'd want a proper HTML parser
            let text_content = strip_html_tags(&chapter_content);
            content.push_str(&text_content);
            content.push_str("\n\n");
        }
    }

    // Estimate pages (rough calculation: ~500 words per page)
    let word_count = content.split_whitespace().count();
    let estimated_pages = (word_count / 500).max(1);

    Ok(Document {
        id: Uuid::new_v4().to_string(),
        title,
        author,
        file_path: file_path.clone(),
        file_type: "epub".to_string(),
        content,
        current_position: 0,
        total_pages: estimated_pages,
    })
}

fn strip_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    
    // Clean up extra whitespace
    result
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
