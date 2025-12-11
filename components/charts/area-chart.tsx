// //components\charts\area-chart.tsx
// import React from "react"


// type Props = {
//   data: any[]
//   xScale: any
//   yScale: any
//   yMax: number
//   width: number
//   margin: any
//   fillColor: string
//   strokeColor: string
//   hideBottomAxis?: boolean
//   hideLeftAxis?: boolean
//   top?: number
//   children?: React.ReactNode
// }

// export default function AreaChart({
//   data,
//   xScale,
//   yScale,
//   yMax,
//   width,
//   margin,
//   fillColor,
//   strokeColor,
//   hideBottomAxis = false,
//   hideLeftAxis = false,
//   top = 0,
//   children,
// }: Props) {
//   const innerWidth = width - margin.left - margin.right
//   return (
//     <g transform={`translate(${margin.left},${top})`}>
//       <AreaClosed
//         data={data}
//         yScale={yScale}
//         x={(d) => xScale(new Date(d?.date))}
//         y={(d) => yScale(d?.enrollments ?? 0)}
//         stroke={strokeColor}
//         fill={fillColor}
//         curve={curveMonotoneX}
//       />
//       <Bar
//         x={0}
//         y={0}
//         width={innerWidth}
//         height={yMax}
//         fill="transparent"
//         rx={14}
//       />
//       {!hideLeftAxis && (
//         <AxisLeft
//           scale={yScale}
//           stroke="#ccc"
//           tickStroke="#ccc"
//           tickLabelProps={{ fill: "#ccc" }}
//         />
//       )}
//       {!hideBottomAxis && (
//         <AxisBottom
//           top={yMax}
//           scale={xScale}
//           stroke="#ccc"
//           tickStroke="#ccc"
//           tickLabelProps={{ fill: "#ccc" }}
//         />
//       )}
//       {children}
//     </g>
//   )
// }
