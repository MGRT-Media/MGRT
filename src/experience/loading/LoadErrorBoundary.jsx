import { Component } from 'react'

/**
 * Contains a failed load to the part of the page that needed it.
 *
 * `useLoader` and `lazy` throw when a file or chunk fails, and with no
 * boundary above them React unmounts the whole root — which on this site means
 * a permanently black page. Wrapped around one object, a failure costs that
 * object; wrapped around the scene, it becomes a visible message instead.
 *
 * `onError` runs once per failure; `fallback` (default nothing) is rendered in
 * place of the children.
 */
export default class LoadErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn(`[${this.props.name ?? 'LoadErrorBoundary'}] failed to load:`, error?.message ?? error)
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
