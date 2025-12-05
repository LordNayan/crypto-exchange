import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  @IsNotEmpty()
  POSTGRES_HOST: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  POSTGRES_PORT: number;

  @IsString()
  @IsNotEmpty()
  POSTGRES_USER: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_DB: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  REDIS_PORT: number;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  BITCOIN_RPC_HOST: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  BITCOIN_RPC_PORT: number;

  @IsString()
  @IsOptional()
  BITCOIN_RPC_USER: string;

  @IsString()
  @IsOptional()
  BITCOIN_RPC_PASSWORD: string;

  @IsString()
  @IsOptional()
  ETHEREUM_RPC_URL: string;

  @IsString()
  @IsOptional()
  ETHEREUM_PRIVATE_KEY: string;
}