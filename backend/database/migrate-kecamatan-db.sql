USE kecamatan_db;

CREATE TABLE IF NOT EXISTS survey_responses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  respondent_name VARCHAR(160) NULL,
  service_type VARCHAR(180) NOT NULL,
  overall_rating TINYINT UNSIGNED NOT NULL,
  ease_rating TINYINT UNSIGNED NOT NULL,
  speed_rating TINYINT UNSIGNED NOT NULL,
  staff_rating TINYINT UNSIGNED NOT NULL,
  feedback TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_survey_created_at (created_at),
  INDEX idx_survey_service_type (service_type),
  CONSTRAINT chk_survey_overall_rating CHECK (overall_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_survey_ease_rating CHECK (ease_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_survey_speed_rating CHECK (speed_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_survey_staff_rating CHECK (staff_rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
