use crate::{Document, Chapter};
use epub::doc::EpubDoc;
use std::path::PathBuf;
use uuid::Uuid;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

pub async fn parse_epub(file_path: &PathBuf) -> Result<Document, String> {
    let mut doc = EpubDoc::new(file_path).map_err(|e| format!("Failed to open EPUB: {}", e))?;

    let title = doc
        .mdata("title")
        .unwrap_or_else(|| "Unknown Title".to_string());
    let author = doc.mdata("creator");

    // Extract all text content and build chapters
    let mut content = String::new();
    let mut chapters = Vec::new();

    // Iterate through spine resources
    let spine = doc.spine.clone();
    for (index, spine_item) in spine.iter().enumerate() {
        if let Some((chapter_content, _)) = doc.get_resource_str(&spine_item.idref) {
            let start_position = content.len();
            
            // Simple HTML tag removal - in a real app you'd want a proper HTML parser
            let text_content = strip_html_tags(&chapter_content);
            content.push_str(&text_content);
            content.push_str("\n\n");
            
            let end_position = content.len();
            
            // Extract chapter title (try to find h1, h2, etc. or use spine item title)
            let chapter_title = extract_chapter_title(&chapter_content, index + 1);
            
            chapters.push(Chapter {
                id: format!("{}_{}", doc.get_current_id().unwrap_or(spine_item.idref.clone()), index),
                title: chapter_title,
                start_position,
                end_position,
            });
        }
    }

    // Estimate pages (rough calculation: ~500 words per page)
    let word_count = content.split_whitespace().count();
    let estimated_pages = (word_count / 500).max(1);

    // Extract cover image
    let cover_image = extract_cover_image(&mut doc);

    Ok(Document {
        id: Uuid::new_v4().to_string(),
        title,
        author,
        file_path: file_path.clone(),
        file_type: "epub".to_string(),
        content,
        current_position: 0,
        total_pages: estimated_pages,
        chapters,
        cover_image,
    })
}

fn extract_chapter_title(html: &str, chapter_number: usize) -> String {
    // Try to find h1, h2, h3 tags for chapter title
    if let Some(title_start) = html.find("<h1") {
        if let Some(content_start) = html[title_start..].find('>') {
            let start_pos = title_start + content_start + 1;
            if let Some(end_pos) = html[start_pos..].find("</h1>") {
                let title = &html[start_pos..start_pos + end_pos];
                return strip_html_tags(title).trim().to_string();
            }
        }
    }
    
    if let Some(title_start) = html.find("<h2") {
        if let Some(content_start) = html[title_start..].find('>') {
            let start_pos = title_start + content_start + 1;
            if let Some(end_pos) = html[start_pos..].find("</h2>") {
                let title = &html[start_pos..start_pos + end_pos];
                return strip_html_tags(title).trim().to_string();
            }
        }
    }
    
    // If no title found, use generic chapter name
    format!("Chapter {}", chapter_number)
}

fn extract_cover_image(doc: &mut EpubDoc<std::io::BufReader<std::fs::File>>) -> Option<String> {
    // Try to get cover image from EPUB metadata
    if let Some((cover_data, _mime_type)) = doc.get_cover() {
        // Convert image data to base64
        let base64_image = BASE64.encode(&cover_data);
        
        // Try to determine image type from first few bytes
        let mime_type = if cover_data.starts_with(b"\x89PNG") {
            "image/png"
        } else if cover_data.starts_with(b"\xFF\xD8") {
            "image/jpeg"
        } else if cover_data.starts_with(b"WEBP") {
            "image/webp"
        } else {
            "image/jpeg" // Default fallback
        };
        
        return Some(format!("data:{};base64,{}", mime_type, base64_image));
    }
    
    None
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
    result.split_whitespace().collect::<Vec<_>>().join(" ")
}
