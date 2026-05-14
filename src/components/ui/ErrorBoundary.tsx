import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-sm text-center">
            <p className="text-2xl mb-3">⚠️</p>
            <h2 className="text-lg font-bold text-gray-900 mb-2">오류가 발생했습니다</h2>
            <p className="text-sm text-gray-500 mb-5">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
            >
              다시 시도
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
