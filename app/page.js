"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Mic, Send, Play, Pause, Plus } from "lucide-react"
import { useSpeechSynthesis } from 'react-speech-kit'

export default function Home() {
  const [isVoicePriority, setIsVoicePriority] = useState(false)
  const [message, setMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [sessions, setSessions] = useState([{ id: 1, messages: [] }])
  const [currentSessionId, setCurrentSessionId] = useState(1)
  const [selectedSession, setSelectedSession] = useState(1)
  const [audioBlob, setAudioBlob] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(new Audio())
  const textareaRef = useRef(null)
  const { speak, cancel, speaking } = useSpeechSynthesis()

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Speech recognition setup
      if ("webkitSpeechRecognition" in window) {
        const SpeechRecognition = window.webkitSpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true

        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("")
          setMessage(transcript)
        }
      }

      // Media recorder setup
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          mediaRecorderRef.current = new MediaRecorder(stream)
          
          mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data)
          }

          mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
            setAudioBlob(audioBlob)
            audioChunksRef.current = []
          }
        })
        .catch(err => console.error("Error accessing microphone:", err))

      // Cleanup
      return () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
        if (recognitionRef.current) {
          recognitionRef.current.stop()
        }
      }
    }
  }, [])

  const createNewChat = () => {
    const newSessionId = sessions.length + 1
    setSessions(prev => [...prev, { id: newSessionId, messages: [] }])
    setCurrentSessionId(newSessionId)
    setSelectedSession(newSessionId)
  }

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      recognitionRef.current?.stop()
    } else {
      audioChunksRef.current = []
      mediaRecorderRef.current?.start()
      recognitionRef.current?.start()
    }
    setIsRecording(!isRecording)
  }

  const handleSend = async () => {
    if ((message.trim() && !isVoicePriority) || (isVoicePriority && audioBlob)) {
      const audioUrl = isVoicePriority ? URL.createObjectURL(audioBlob) : null

      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, { 
              type: "user", 
              content: isVoicePriority ? "🎤 Voice message" : message,
              audioUrl: audioUrl,
              timestamp: new Date().toISOString()
            }]
          }
        }
        return session
      }))

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: message }),
        })
        const data = await response.json()
        
        setSessions(prev => prev.map(session => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: [...session.messages, { 
                type: "azmth", 
                content: data.response,
                timestamp: new Date().toISOString()
              }]
            }
          }
          return session
        }))

        if (isVoicePriority) {
          speak({ text: data.response })
        }
      } catch (error) {
        console.error("Error sending message:", error)
        setSessions(prev => prev.map(session => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: [...session.messages, { 
                type: "azmth", 
                content: "Error processing your request.",
                timestamp: new Date().toISOString()
              }]
            }
          }
          return session
        }))
      }

      setMessage("")
      setAudioBlob(null)
      if (isRecording) {
        toggleRecording()
      }
    }
  }

  const handleSessionClick = (sessionId) => {
    setSelectedSession(sessionId)
    setCurrentSessionId(sessionId)
  }

  const handlePlayPause = (audioUrl) => {
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.src = audioUrl
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handlePlayResponse = (text) => {
    if (speaking) {
      cancel()
    } else {
      speak({ text })
    }
  }

  // Handle audio ended
  useEffect(() => {
    audioRef.current.onended = () => setIsPlaying(false)
  }, [])

  return (
    <div className="flex h-full p-4 bg-gray-900 text-white">
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-between mb-4 pr-4">
          <Button 
            onClick={createNewChat}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={16} /> New Chat
          </Button>
          <div className="flex items-center">
            <span className="mr-2">Text</span>
            <Switch checked={isVoicePriority} onCheckedChange={setIsVoicePriority} />
            <span className="ml-2">Voice</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto mb-4 px-4">
          {selectedSession ? (
            sessions
              .find(session => session.id === selectedSession)
              ?.messages.map((msg, index) => (
                <div key={index} className={`mb-4 ${msg.type === "user" ? "text-right" : "text-left"}`}>
                  <div className={`inline-block p-3 rounded-lg ${
                    msg.type === "user" ? "bg-blue-600" : "bg-gray-700"
                  }`}>
                    <div className="flex items-center gap-2">
                      {msg.content}
                      {msg.audioUrl && (
                        <Button 
                          onClick={() => handlePlayPause(msg.audioUrl)}
                          variant="ghost"
                          size="sm"
                          className="hover:bg-blue-700"
                        >
                          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  {msg.type === "azmth" && isVoicePriority && (
                    <Button 
                      onClick={() => handlePlayResponse(msg.content)}
                      variant="ghost"
                      size="sm"
                      className="mt-1"
                    >
                      {speaking ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                  )}
                </div>
              ))
          ) : (
            <div className="text-center text-gray-400">Select a session to view the conversation</div>
          )}
        </div>
        <div className="flex items-end space-x-2 px-4">
          {!isVoicePriority && (
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder="Type your message..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                className="w-full pr-10 resize-none overflow-hidden bg-gray-800 border-gray-700"
                style={{ minHeight: "40px", maxHeight: "200px" }}
              />
            </div>
          )}
          {isVoicePriority && (
            <Button 
              onClick={toggleRecording} 
              variant={isRecording ? "destructive" : "default"}
              className={`${isRecording ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              <Mic className={isRecording ? "animate-pulse" : ""} />
            </Button>
          )}
          <Button 
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send />
          </Button>
        </div>
      </div>
      <div className="w-1/4 border-l border-gray-700 pl-4">
        <h2 className="text-lg font-bold mb-2">Chat History</h2>
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`cursor-pointer mb-2 p-3 rounded transition-colors ${
              session.id === selectedSession 
                ? 'bg-blue-700 hover:bg-blue-800' 
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            onClick={() => handleSessionClick(session.id)}
          >
            <div className="font-medium">
              {session.messages.length > 0 
                ? session.messages[0].content 
                : `New Chat ${session.id}`}
            </div>
            {session.messages.length > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                {new Date(session.messages[0].timestamp).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}