use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{migrate::MigrateDatabase, Row, Sqlite, SqlitePool};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredDocument {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub file_path: String,
    pub file_type: String,
    pub total_pages: i32,
    pub current_position: i32,
    pub last_read: DateTime<Utc>,
    pub added_date: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub theme: String,
    pub font_family: String,
    pub font_size: i32,
    pub line_height: f32,
    pub letter_spacing: f32,
    pub words_per_page: i32,
    pub page_margin: String,
    pub justify_text: bool,
    pub hyphenation: bool,
    pub animation_speed: String,
    pub page_curl: bool,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            font_family: "georgia".to_string(),
            font_size: 18,
            line_height: 1.6,
            letter_spacing: 0.0,
            words_per_page: 400,
            page_margin: "normal".to_string(),
            justify_text: true,
            hyphenation: true,
            animation_speed: "normal".to_string(),
            page_curl: true,
        }
    }
}

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let app_dir = dirs::data_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
            .join("MindfulReader");

        std::fs::create_dir_all(&app_dir)?;
        let db_path = app_dir.join("library.db");
        let db_url = format!("sqlite://{}", db_path.to_string_lossy());

        if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
            Sqlite::create_database(&db_url).await?;
        }

        let pool = SqlitePool::connect(&db_url).await?;
        let database = Self { pool };
        database.initialize_tables().await?;

        Ok(database)
    }

    async fn initialize_tables(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT,
                file_path TEXT NOT NULL UNIQUE,
                file_type TEXT NOT NULL,
                total_pages INTEGER NOT NULL DEFAULT 0,
                current_position INTEGER NOT NULL DEFAULT 0,
                last_read DATETIME DEFAULT CURRENT_TIMESTAMP,
                added_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                theme TEXT NOT NULL DEFAULT 'light',
                font_family TEXT NOT NULL DEFAULT 'georgia',
                font_size INTEGER NOT NULL DEFAULT 18,
                line_height REAL NOT NULL DEFAULT 1.6,
                letter_spacing REAL NOT NULL DEFAULT 0.0,
                words_per_page INTEGER NOT NULL DEFAULT 400,
                page_margin TEXT NOT NULL DEFAULT 'normal',
                justify_text BOOLEAN NOT NULL DEFAULT TRUE,
                hyphenation BOOLEAN NOT NULL DEFAULT TRUE,
                animation_speed TEXT NOT NULL DEFAULT 'normal',
                page_curl BOOLEAN NOT NULL DEFAULT TRUE
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query("INSERT OR IGNORE INTO user_settings (id) VALUES (1)")
            .execute(&self.pool)
            .await?;

        // Create chapters table for caching
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS chapters (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                title TEXT NOT NULL,
                start_position INTEGER NOT NULL,
                end_position INTEGER NOT NULL,
                chapter_order INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Create index for faster chapter lookups
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_chapters_document_id ON chapters (document_id)"
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn save_document(&self, doc: &StoredDocument) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO documents 
            (id, title, author, file_path, file_type, total_pages, current_position, last_read, added_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&doc.id)
        .bind(&doc.title)
        .bind(&doc.author)
        .bind(&doc.file_path)
        .bind(&doc.file_type)
        .bind(doc.total_pages)
        .bind(doc.current_position)
        .bind(doc.last_read)
        .bind(doc.added_date)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_all_documents(&self) -> Result<Vec<StoredDocument>> {
        let rows = sqlx::query(
            "SELECT id, title, author, file_path, file_type, total_pages, current_position, last_read, added_date FROM documents ORDER BY last_read DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        let documents = rows
            .into_iter()
            .map(|row| StoredDocument {
                id: row.get("id"),
                title: row.get("title"),
                author: row.get("author"),
                file_path: row.get("file_path"),
                file_type: row.get("file_type"),
                total_pages: row.get("total_pages"),
                current_position: row.get("current_position"),
                last_read: row.get("last_read"),
                added_date: row.get("added_date"),
            })
            .collect();

        Ok(documents)
    }

    pub async fn update_reading_progress(&self, document_id: &str, position: i32) -> Result<()> {
        sqlx::query(
            "UPDATE documents SET current_position = ?, last_read = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(position)
        .bind(document_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn save_settings(&self, settings: &UserSettings) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE user_settings SET
                theme = ?, font_family = ?, font_size = ?, line_height = ?, letter_spacing = ?,
                words_per_page = ?, page_margin = ?, justify_text = ?, hyphenation = ?,
                animation_speed = ?, page_curl = ?
            WHERE id = 1
            "#,
        )
        .bind(&settings.theme)
        .bind(&settings.font_family)
        .bind(settings.font_size)
        .bind(settings.line_height)
        .bind(settings.letter_spacing)
        .bind(settings.words_per_page)
        .bind(&settings.page_margin)
        .bind(settings.justify_text)
        .bind(settings.hyphenation)
        .bind(&settings.animation_speed)
        .bind(settings.page_curl)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn delete_document(&self, document_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM documents WHERE id = ?")
            .bind(document_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn get_settings(&self) -> Result<UserSettings> {
        let row = sqlx::query(
            r#"
            SELECT theme, font_family, font_size, line_height, letter_spacing,
                   words_per_page, page_margin, justify_text, hyphenation,
                   animation_speed, page_curl
            FROM user_settings WHERE id = 1
            "#,
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(UserSettings {
                theme: row.get("theme"),
                font_family: row.get("font_family"),
                font_size: row.get("font_size"),
                line_height: row.get("line_height"),
                letter_spacing: row.get("letter_spacing"),
                words_per_page: row.get("words_per_page"),
                page_margin: row.get("page_margin"),
                justify_text: row.get("justify_text"),
                hyphenation: row.get("hyphenation"),
                animation_speed: row.get("animation_speed"),
                page_curl: row.get("page_curl"),
            })
        } else {
            Ok(UserSettings::default())
        }
    }

    // Chapter caching methods for performance
    pub async fn save_chapters(&self, document_id: &str, chapters: &[crate::Chapter]) -> Result<()> {
        // Delete existing chapters for this document
        sqlx::query("DELETE FROM chapters WHERE document_id = ?")
            .bind(document_id)
            .execute(&self.pool)
            .await?;

        // Insert new chapters in batch
        for (order, chapter) in chapters.iter().enumerate() {
            sqlx::query(
                r#"
                INSERT INTO chapters 
                (id, document_id, title, start_position, end_position, chapter_order)
                VALUES (?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(&chapter.id)
            .bind(document_id)
            .bind(&chapter.title)
            .bind(chapter.start_position as i32)
            .bind(chapter.end_position as i32)
            .bind(order as i32)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    pub async fn get_cached_chapters(&self, document_id: &str) -> Result<Option<Vec<crate::Chapter>>> {
        let rows = sqlx::query(
            "SELECT id, title, start_position, end_position FROM chapters WHERE document_id = ? ORDER BY chapter_order"
        )
        .bind(document_id)
        .fetch_all(&self.pool)
        .await?;

        if rows.is_empty() {
            return Ok(None);
        }

        let chapters = rows
            .into_iter()
            .map(|row| crate::Chapter {
                id: row.get("id"),
                title: row.get("title"),
                start_position: row.get::<i32, _>("start_position") as usize,
                end_position: row.get::<i32, _>("end_position") as usize,
            })
            .collect();

        Ok(Some(chapters))
    }

    pub async fn clear_document_cache(&self, document_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM chapters WHERE document_id = ?")
            .bind(document_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
