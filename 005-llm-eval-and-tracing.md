# Challenge 5: LLM Evaluation & Tracing - "The Quality Guardian" 🔍

## Introduction

As your RAG system grows more complex, understanding what's happening under the hood becomes crucial. In this challenge, you'll implement LLM observability and evaluation using [Langfuse](https://langfuse.com/docs/get-started), an open-source LLM engineering platform.

## Step 1: Getting Started with Tracing 🚀

### 1. Configure Langfuse

First, set up your Langfuse environment variables in `.env.local`:

You can get and set your API keys by:
1. Creating a Langfuse account
2. Creating a new project
3. Generating API credentials in the project settings
4. Copy the API keys from the Langfuse console to your `.env.local` file

### 2. Understanding the Tracing Setup

Your email generation is already configured to send traces to Langfuse.
Langfuse is for example implemented in `src/lib/langchain/TranscriptSummaryChain.ts` based on the Langchain integration that Langfuse offers.

Test the full email generation capability and explore the collected traces in your Langfuse console.

## Step 2: Configure tracing for Search Summary

The search summary interface (at `src/app/api/generate-summary/route.ts`) is still missing LLM input and output tracing.

Implement it based on the [Langfuse Documentation](https://langfuse.com/docs/sdk/typescript/guide)

## Next Steps: 
Congratulations, you're done and that was the last one.