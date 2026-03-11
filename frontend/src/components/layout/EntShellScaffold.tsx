import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { SxProps, Theme } from '@mui/material/styles'
import Header from '../Header'

interface EntShellScaffoldProps {
  children: React.ReactNode
  contentSx?: SxProps<Theme>
  frameSize?: 'short' | 'standard'
  minShellHeight?: number
}

const ARTBOARD_WIDTH = 2730
const ARTBOARD_HEIGHT = 1536
const COLUMN_REPEAT_STEP = 671 / ARTBOARD_HEIGHT
const COLUMN_REPEAT_OVERLAP = 30
const LEFT_COLUMN_REPEAT_EXTRA_OVERLAP = 14
const LEFT_COLUMN_REPEAT_SCALE_Y = 1.026
const TOPBAR_TOP = 0.3035
const CONTENT_TOP = 0.423
const CONTENT_BOTTOM = 0.187
const WELL_TOP = 0.416
const WELL_BOTTOM = 0.181

const frameImg = (src: string, sx?: SxProps<Theme>) => (
  <Box
    component="img"
    src={src}
    alt=""
    aria-hidden="true"
    sx={{
      position: 'absolute',
      left: 0,
      width: '100%',
      height: '100%',
      display: 'block',
      objectFit: 'contain',
      pointerEvents: 'none',
      userSelect: 'none',
      ...sx,
    }}
  />
)

export default function EntShellScaffold({
  children,
  contentSx,
  frameSize = 'standard',
  minShellHeight = 760,
}: EntShellScaffoldProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [shellWidth, setShellWidth] = useState(0)
  const sideColumnRepeats = frameSize === 'standard' ? 1 : 0

  useLayoutEffect(() => {
    if (!shellRef.current) return

    const node = shellRef.current
    const measure = () => setShellWidth(node.getBoundingClientRect().width)
    measure()

    const observer = new ResizeObserver(() => measure())
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const shellMetrics = useMemo(() => {
    const measuredBase = shellWidth > 0 ? (shellWidth * ARTBOARD_HEIGHT) / ARTBOARD_WIDTH : minShellHeight
    const baseHeight = Math.max(minShellHeight, measuredBase)
    const repeatStepPx = baseHeight * COLUMN_REPEAT_STEP
    const extensionHeight = repeatStepPx * sideColumnRepeats - COLUMN_REPEAT_OVERLAP * sideColumnRepeats

    return {
      baseHeight,
      repeatStepPx,
      totalHeight: baseHeight + extensionHeight,
      topbarTopPx: baseHeight * TOPBAR_TOP,
      contentTopPx: baseHeight * CONTENT_TOP,
      contentBottomPx: baseHeight * CONTENT_BOTTOM,
      wellTopPx: baseHeight * WELL_TOP,
      wellBottomPx: baseHeight * WELL_BOTTOM,
    }
  }, [minShellHeight, shellWidth, sideColumnRepeats])

  const repeatedColumnOffsets = Array.from({ length: sideColumnRepeats }, (_, index) => {
    const repeatIndex = index + 1
    return {
      left: shellMetrics.repeatStepPx * repeatIndex - (COLUMN_REPEAT_OVERLAP + LEFT_COLUMN_REPEAT_EXTRA_OVERLAP) * repeatIndex,
      right: shellMetrics.repeatStepPx * repeatIndex - COLUMN_REPEAT_OVERLAP * repeatIndex,
    }
  })

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1.5, md: 2.5 },
        py: { xs: 1.5, md: 2.5 },
        overflow: 'auto',
      }}
    >
      <Box sx={{ width: 'min(100%, 1500px)', mx: 'auto' }}>
        <Box
          ref={shellRef}
          sx={{
            position: 'relative',
            width: '100%',
            height: `${shellMetrics.totalHeight}px`,
            borderRadius: '40px',
            overflow: 'hidden',
            background:
              'radial-gradient(circle at 50% 100%, rgba(240, 195, 106, 0.08), transparent 28%), linear-gradient(180deg, rgba(14, 10, 7, 0.96), rgba(4, 3, 2, 0.98))',
            boxShadow: '0 32px 60px rgba(0,0,0,0.42)',
          }}
        >
          {frameImg('/ent-shell/top_left_cap.png', {
            top: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 3,
            transform: 'translate(1px, 3px)',
          })}
          {frameImg('/ent-shell/top_left_repeating.png', {
            top: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 3,
            transform: 'translate(1px, 6px)',
          })}
          {frameImg('/ent-shell/top_center_medallion.png', {
            top: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 3,
            transform: 'translate(-1px, 3px)',
          })}
          {frameImg('/ent-shell/top_right_repeating.png', {
            top: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 3,
            transform: 'translate(-2px, 6px)',
          })}
          {frameImg('/ent-shell/top_right_cap.png', {
            top: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 3,
            transform: 'translate(-2px, 3px)',
          })}
          {frameImg('/ent-shell/menu_area.png', {
            top: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 5,
          })}

          {frameImg('/ent-shell/left_column.png', {
            top: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 2,
            transform: 'translateY(2px)',
          })}
          {frameImg('/ent-shell/right_column.png', {
            top: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 2,
            transform: 'translateY(2px)',
          })}
          {repeatedColumnOffsets.map((offset, index) => (
            <React.Fragment key={offset.left}>
              {frameImg('/ent-shell/left_column.png', {
                top: `${offset.left}px`,
                height: `${shellMetrics.baseHeight}px`,
                zIndex: 2,
                opacity: 0.99,
                transform: `translateY(${2 + index}px) scaleY(${LEFT_COLUMN_REPEAT_SCALE_Y})`,
                transformOrigin: 'top center',
              })}
              {frameImg('/ent-shell/right_column.png', {
                top: `${offset.right}px`,
                height: `${shellMetrics.baseHeight}px`,
                zIndex: 2,
                opacity: 0.99,
                transform: `translateY(${2 + index}px)`,
              })}
            </React.Fragment>
          ))}

          {frameImg('/ent-shell/bottom_left_cap.png', {
            bottom: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 4,
            transform: 'translate(11px, -18px)',
          })}
          {frameImg('/ent-shell/bottom_repeating.png', {
            bottom: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 4,
            transform: 'translate(11px, -18px)',
          })}
          {frameImg('/ent-shell/bottom_right_cap.png', {
            bottom: 0,
            height: `${shellMetrics.baseHeight}px`,
            zIndex: 4,
            transform: 'translate(11px, -18px)',
          })}

          <Box
            sx={{
              position: 'absolute',
              left: '15.1%',
              right: '7.4%',
              top: `${shellMetrics.wellTopPx}px`,
              bottom: `${shellMetrics.wellBottomPx}px`,
              zIndex: 1,
              borderRadius: '34px',
              background:
                'radial-gradient(circle at 50% 0%, rgba(255, 205, 128, 0.08), transparent 52%), linear-gradient(180deg, rgba(86, 40, 8, 0.84), rgba(47, 18, 5, 0.96))',
              boxShadow:
                'inset 0 0 0 1px rgba(195, 146, 86, 0.14), inset 0 28px 46px rgba(0, 0, 0, 0.12), inset 0 -28px 44px rgba(0, 0, 0, 0.22)',
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              top: `${shellMetrics.topbarTopPx}px`,
              left: '15.8%',
              width: '41.2%',
              zIndex: 6,
            }}
          >
            <Header />
          </Box>

          <Box
            sx={{
              position: 'absolute',
              left: '15.4%',
              right: '7.9%',
              top: `${shellMetrics.contentTopPx}px`,
              bottom: `${shellMetrics.contentBottomPx}px`,
              zIndex: 6,
              minHeight: 0,
              p: { xs: 1.5, md: 2.25 },
              overflow: 'auto',
              ...contentSx,
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
