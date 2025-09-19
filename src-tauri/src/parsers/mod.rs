pub mod epub_parser;
pub mod pdf_parser;
pub mod txt_parser;

use crate::Document;
use std::path::PathBuf;

pub trait DocumentParser {
    async fn parse(file_path: &PathBuf) -> Result<Document, String>;
}
