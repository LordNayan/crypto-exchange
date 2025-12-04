import { SetMetadata } from '@nestjs/common';

export const IS_API_KEY_PROTECTED = 'isApiKeyProtected';
export const ApiKeyProtected = () => SetMetadata(IS_API_KEY_PROTECTED, true);
