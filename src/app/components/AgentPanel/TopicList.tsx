// src/app/components/AgentPanel/TopicList.tsx
'use client';

import { useState } from 'react';

interface Topic {
    title: string;
    commentaries: string[];
}

interface TopicListProps {
    topics: Topic[];
}

const TopicList = ({ topics }: TopicListProps) => {
    const [openTopic, setOpenTopic] = useState<string | null>(null);

    const toggleTopic = (title: string) => {
        setOpenTopic(openTopic === title ? null : title);
    };

    return (
        <div className="bg-gray-800 p-4 rounded-2xl shadow-2xl w-full text-white border border-gray-700 h-full">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Topics</h2>
            <div className="space-y-2">
                {topics.map((topic) => (
                    <div key={topic.title}>
                        <button
                            onClick={() => toggleTopic(topic.title)}
                            className="w-full text-left font-semibold p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all"
                        >
                            {topic.title}
                        </button>
                        {openTopic === topic.title && (
                            <div className="p-2 mt-1 bg-gray-900 rounded-lg">
                                {topic.commentaries.map((commentary, index) => (
                                    <p key={index} className="text-gray-300 text-sm">- {commentary}</p>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {topics.length === 0 && <p className="text-gray-400">No topics identified yet.</p>}
            </div>
        </div>
    );
};

export default TopicList;
