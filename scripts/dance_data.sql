CREATE TABLE `games` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` varchar(255) NOT NULL
);

CREATE TABLE `songs` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `game_id` int NOT NULL,
  `native_title` varchar(255) NOT NULL,
  `translit_title` varchar(255),
  `native_artist` varchar(255) NOT NULL,
  `translit_artist` varchar(255),
  `jacket_image` varchar(255) NOT NULL,
  `bpm_min` int NOT NULL,
  `bpm_max` int NOT NULL,
  FOREIGN KEY (`game_id`) REFERENCES `games` (`id`)
);

CREATE TABLE `charts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `song_id` int NOT NULL,
  `game_id` int NOT NULL,
  `lvl` int NOT NULL,
  `jacket_image` varchar(255),
  `bpm_min` int,
  `bpm_max` int,
  FOREIGN KEY (`song_id`) REFERENCES `songs` (`id`),
  FOREIGN KEY (`game_id`) REFERENCES `games` (`id`)
);

CREATE TABLE `categories` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `game_id` int,
  `name` varchar(255),
  FOREIGN KEY (`game_id`) REFERENCES `games` (`id`)
);

CREATE TABLE `chart_categories` (
  `chart_id` int,
  `category_id` int,
  FOREIGN KEY (`chart_id`) REFERENCES `charts` (`id`),
  FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
);

CREATE TABLE `flags` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` varchar(63) UNIQUE NOT NULL,
  `description` text
);

CREATE TABLE `song_flags` (
  `song_id` int NOT NULL,
  `flag_id` int NOT NULL,
  FOREIGN KEY (`song_id`) REFERENCES `songs` (`id`),
  FOREIGN KEY (`flag_id`) REFERENCES `flags` (`id`)
);

CREATE TABLE `chart_flags` (
  `chart_id` int NOT NULL,
  `flag_id` int NOT NULL,
  FOREIGN KEY (`chart_id`) REFERENCES `charts` (`id`),
  FOREIGN KEY (`flag_id`) REFERENCES `flags` (`id`)
);

CREATE INDEX `charts_index_0` ON `charts` (`game_id`, `lvl`);

CREATE INDEX `category_index_1` ON `category` (`game_id`);
