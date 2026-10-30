<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

class Guido extends BaseConfig
{
    public string $host = 'https://146.48.84.175:8080';
    public string $authSecret = '';

    public function __construct()
    {
        parent::__construct();
        $this->authSecret = (string) env('GUIDO_AUTH_SECRET', '');
    }
}
