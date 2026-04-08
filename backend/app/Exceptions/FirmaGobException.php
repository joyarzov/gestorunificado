<?php

namespace App\Exceptions;

class FirmaGobException extends \RuntimeException
{
    public function __construct(
        string $message,
        private array $apiResponse = [],
        private bool $retryable = false,
        int $code = 0,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $code, $previous);
    }

    public function getApiResponse(): array
    {
        return $this->apiResponse;
    }

    public function isRetryable(): bool
    {
        return $this->retryable;
    }
}
