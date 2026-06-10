import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Catches render/runtime errors in any page so one broken page never
 * takes down the whole app (white/frozen screen). The sidebar + shell stay
 * usable and the user can navigate away or reload.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-20 px-6">
          <div className="text-5xl opacity-60">😵‍💫</div>
          <div className="text-base font-semibold text-foreground">เกิดข้อผิดพลาดในหน้านี้</div>
          <div className="text-[13px] text-default-500 max-w-md break-words font-mono bg-content2 rounded-lg px-3 py-2 border border-content3">
            {this.state.error.message}
          </div>
          <div className="flex gap-2">
            <button onClick={this.reset}
              className="bg-gradient-to-r from-[#7c6df3] to-[#a855f7] text-white text-sm font-semibold px-5 py-2 rounded-lg shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity">
              ลองใหม่
            </button>
            <button onClick={() => window.location.reload()}
              className="bg-content2 border border-content3 text-default-600 text-sm font-medium px-5 py-2 rounded-lg hover:bg-content3 transition-colors">
              โหลดแอปใหม่
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
