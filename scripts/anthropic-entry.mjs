// Entry point for the browser bundle of the official Anthropic SDK (built by `npm run build:sdk`).
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

window.AnthropicSDK = { Anthropic, jsonSchemaOutputFormat };
