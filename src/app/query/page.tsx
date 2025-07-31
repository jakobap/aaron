// src/app/query/page.tsx
"use client"
import React, { useState, useEffect } from 'react';
import { InstructionsPanel } from '@/app/components/QueryPanel/InstructionsPanel';
import { TranscriptInput } from '@/app/components/QueryPanel/TranscriptInput';
import { EmailOutput } from '@/app/components/QueryPanel/EmailOutput';
import { InfoFooter } from '@/app/components/QueryPanel/InfoFooter';
import { DocumentList, DocumentListSkeleton } from '@/app/components/QueryPanel/DocumentList';
import { GreetingHeader } from '@/app/components/QueryPanel/GreetingHeader'
import ResearchTopics from '../components/QueryPanel/ResearchTopicResults';

// Types for the transcript processing response
interface Task {
  description: string;
  context: string;
}

interface ResearchResult {
  answer: string;
  steps: string[];
  caveats: string[];
  docReferences: Array<{ title: string; url: string }>;
}

interface ProcessingResponse {
  tasks: Task[];
  research: ResearchResult[];
  email: string;
}

export interface EmailGenerationState {
  isProcessing: boolean;
  showSuccess: boolean;
  copySuccess: boolean;
}

interface Document {
  id: string;
  url: string;
  indexedAt: string;
  status: 'indexed' | 'failed' | 'pending';
}

const QueryPanelPage = () => {
  // State management
  const [transcript, setTranscript] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<EmailGenerationState>({
    isProcessing: false,
    showSuccess: false,
    copySuccess: false,
  });
  const [indexingStatus, setIndexingStatus] = useState<'idle' | 'running' | 'error' | 'success'>('idle');

  const [researchData, setResearchData] = useState<{
    tasks: Task[];
    research: ResearchResult[];
  }>({
    tasks: [],
    research: []
  });

  // Document refresh logic
  const refreshDocuments = async () => {
    try {
      setIsLoadingDocs(true);
      setError(null);
      setIndexingStatus('running');

      const response = await fetch('/api/indexing');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();

      if (data.documents && Array.isArray(data.documents)) {
        setDocuments(data.documents);

        // Update indexing status based on documents state
        const hasFailedDocs = data.documents.some((doc: Document) => doc.status === 'failed');
        const hasPendingDocs = data.documents.some((doc: Document) => doc.status === 'pending');

        if (hasFailedDocs) {
          setIndexingStatus('error');
        } else if (hasPendingDocs) {
          setIndexingStatus('running');
        } else {
          setIndexingStatus('success');
        }
      } else {
        throw new Error('Invalid document data received');
      }
    } catch (error) {
      console.error('Error refreshing documents:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setIndexingStatus('error');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Initial load effect
    useEffect(() => {
    refreshDocuments();
    const pollingInterval = setInterval(() => {
      if (documents.some(doc => doc.status === 'pending')) {
        refreshDocuments();
      }
    }, 5000);
    return () => clearInterval(pollingInterval);
  }, [documents]);

  // Modified handleSubmit to store research data
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcript.trim()) return;

    setState(prev => ({ ...prev, isProcessing: true }));
    setProcessingError(null);

    try {
      const response = await fetch('/api/process-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process transcript');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to process transcript');
      }

      const result = data.data as ProcessingResponse;

      // Set both email and research data
      setGeneratedEmail(result.email);
      setResearchData({
        tasks: result.tasks,
        research: result.research
      });

      // Show success message
      setState(prev => ({ ...prev, showSuccess: true }));
      setTimeout(() => setState(prev => ({ ...prev, showSuccess: false })), 3000);

    } catch (error) {
      console.error('Error processing transcript:', error);
      setProcessingError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Handle email copy remains the same...
  const handleCopyEmail = () => {
    navigator.clipboard.writeText(generatedEmail);
    setState(prev => ({ ...prev, copySuccess: true }));
    setTimeout(() => setState(prev => ({ ...prev, copySuccess: false })), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header and Documentation Status */}
        <div className="mb-8">
          <GreetingHeader />
        </div>

        {/* Instructions */}
        <InstructionsPanel />

        {/* Input Row */}
        <div className="mb-6">
          <TranscriptInput
            transcript={transcript}
            onTranscriptChange={setTranscript}
            onSubmit={handleSubmit}
            isProcessing={state.isProcessing}
          />
        </div>

        <div className="mb-6 w-full">
          <ResearchTopics
            tasks={researchData.tasks}
            research={researchData.research}
            isLoading={state.isProcessing}
          />
        </div>

        {/* Research and Output Row */}
        <div className="mb-6">
          <EmailOutput
            generatedEmail={generatedEmail}
            onRegenerate={handleSubmit}
            onCopy={handleCopyEmail}
            showSuccess={state.showSuccess}
            copySuccess={state.copySuccess}
            error={processingError}
          />
        </div>

        {/* Document List */}
        {isLoadingDocs ? (
          <DocumentListSkeleton />
        ) : (
          <DocumentList documents={documents} />
        )}

        {/* Footer */}
        <InfoFooter />
      </div>
    </div>
  );
};

export default QueryPanelPage;