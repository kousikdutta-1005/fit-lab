import { useEffect, useRef, useState } from "react"
import { Callout } from "./ui"

/**
 * The photo step.
 *
 * There is no validated method for estimating body fat from a 2D photograph,
 * and even 3D scanning only holds up at group level. So this does not measure
 * anything and does not upload anything. It puts your character beside a
 * picture of you and lets you correct the character by eye.
 *
 * The image is held in an object URL in this tab and never leaves the device.
 */
export function PhotoCheck({
  children,
  onFile,
}: {
  children: React.ReactNode
  onFile?: (has: boolean) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  function accept(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return
    if (url) URL.revokeObjectURL(url)
    const next = URL.createObjectURL(file)
    setUrl(next)
    onFile?.(true)
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: url ? "1fr 1fr" : "1fr",
          gap: "0.9rem",
          alignItems: "stretch",
        }}
      >
        <div
          className="card"
          style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {children}
        </div>

        {url && (
          <div
            className="card"
            style={{
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <img
              src={url}
              alt="The photo you chose, shown only on this device"
              style={{ maxHeight: 320, maxWidth: "100%", objectFit: "contain", borderRadius: 8 }}
            />
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          accept(e.dataTransfer.files?.[0])
        }}
        style={{ marginTop: "0.9rem" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => accept(e.target.files?.[0])}
          style={{ display: "none" }}
        />
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn btn-quiet" onClick={() => inputRef.current?.click()}>
            {url ? "Choose a different photo" : "Add a full-body photo"}
          </button>
          {url && (
            <button
              className="btn btn-quiet"
              onClick={() => {
                URL.revokeObjectURL(url)
                setUrl(null)
                onFile?.(false)
              }}
            >
              Remove it
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: "1.1rem" }}>
        <Callout title="What the photo does, and what it cannot do">
          <p style={{ margin: 0 }}>
            It stays on your device. It is not uploaded, not analysed and not stored, and closing this tab
            removes it. Nothing here can measure your body from a picture. There is no validated way to do that
            from a single photograph, and any product claiming otherwise is guessing at you with confidence.
          </p>
          <p style={{ margin: "0.6rem 0 0" }}>
            What it is for is your own eye. Put the two side by side and drag the sliders until the figure
            looks like you rather than like the version of you that you would prefer. The whole assessment is
            only worth as much as that honesty.
          </p>
        </Callout>
      </div>
    </div>
  )
}
