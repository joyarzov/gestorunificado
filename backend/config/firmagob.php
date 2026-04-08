<?php

return [
    'enabled'       => env('FIRMAGOB_ENABLED', false),
    'simulate'      => env('FIRMAGOB_SIMULATE', false), // Simula firma sin llamar al API real
    'sandbox_mode'  => env('FIRMAGOB_SANDBOX_MODE', true),
    'sandbox_run'   => env('FIRMAGOB_SANDBOX_RUN', '11111111'),
    'url'           => env('FIRMAGOB_URL', 'https://api.firma.cert.digital.gob.cl/firma/v2/files/tickets'),
    'api_token_key' => env('FIRMAGOB_API_TOKEN_KEY', ''),
    'secret'        => env('FIRMAGOB_SECRET', ''),
    'entity'        => env('FIRMAGOB_ENTITY', ''),
    'purpose'       => env('FIRMAGOB_PURPOSE', 'Propósito General'),
    'timeout'       => env('FIRMAGOB_TIMEOUT', 30),
];
