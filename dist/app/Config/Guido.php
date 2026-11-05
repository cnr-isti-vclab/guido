<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

class Guido extends BaseConfig
{
    public string $host = 'https://nb-ganovelli.isti.cnr.it:8080';
    public string $authSecret = '';

    public function __construct()
    {
        parent::__construct();
        $this->authSecret = (string) env('GUIDO_AUTH_SECRET', '');
    }
}
