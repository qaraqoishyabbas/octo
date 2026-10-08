<?php

return [
  'avatar_max_mb' => (int)env('UPLOAD_AVATAR_MAX_MB', 5),
  'message_max_mb' => (int)env('UPLOAD_MESSAGE_MAX_MB', 100),
  'message_max_files' => (int)env('UPLOAD_MESSAGE_MAX_FILES', 10),
];
