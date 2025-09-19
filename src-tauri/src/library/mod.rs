use crate::{Document, ReadingProgress};
use std::collections::HashMap;
use tokio::sync::RwLock;

#[derive(Default)]
pub struct Library {
    documents: RwLock<HashMap<String, Document>>,
    reading_progress: RwLock<HashMap<String, ReadingProgress>>,
}

impl Library {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn add_document(&self, document: Document) {
        let mut docs = self.documents.write().await;
        docs.insert(document.id.clone(), document);
    }

    pub async fn get_document(&self, id: &str) -> Option<Document> {
        let docs = self.documents.read().await;
        docs.get(id).cloned()
    }

    pub async fn get_all_documents(&self) -> Vec<Document> {
        let docs = self.documents.read().await;
        docs.values().cloned().collect()
    }

    pub async fn update_progress(&self, progress: ReadingProgress) {
        let mut prog = self.reading_progress.write().await;
        let document_id = progress.document_id.clone();
        let position = progress.position;
        prog.insert(document_id.clone(), progress);

        // Also update the document's current position
        let mut docs = self.documents.write().await;
        if let Some(doc) = docs.get_mut(&document_id) {
            doc.current_position = position;
        }
    }

    pub async fn get_progress(&self, document_id: &str) -> Option<ReadingProgress> {
        let prog = self.reading_progress.read().await;
        prog.get(document_id).cloned()
    }

    pub async fn search_document(
        &self,
        document_id: String,
        query: String,
    ) -> Result<Vec<(usize, String)>, String> {
        let docs = self.documents.read().await;
        let document = docs.get(&document_id).ok_or("Document not found")?;

        let mut results = Vec::new();
        let lines: Vec<&str> = document.content.lines().collect();

        for (line_num, line) in lines.iter().enumerate() {
            if line.to_lowercase().contains(&query.to_lowercase()) {
                results.push((line_num, line.to_string()));
            }
        }

        Ok(results)
    }

    pub async fn remove_document(&self, document_id: &str) -> bool {
        let mut docs = self.documents.write().await;
        let mut prog = self.reading_progress.write().await;

        prog.remove(document_id);
        docs.remove(document_id).is_some()
    }
}
