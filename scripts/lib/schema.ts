import * as z from 'zod'

const SchoolSchema = z.object({
	r: z.string(), // RUC
	n: z.string(), // name
	a: z.string(), // address
	u: z.string(), // district code
	g: z.tuple([z.number(), z.number()]).optional(), // [lat, lng]
	p: z.string().optional(), // Google place ID
})

export type School = z.infer<typeof SchoolSchema>

const GeoNodeSchema = z.union([
	z.object({ n: z.string(), u: z.string() }),
	z.object({
		n: z.string(),
		get k() { // children
			return z.array(GeoNodeSchema)
		},
	}),
])

export type GeoNode = z.infer<typeof GeoNodeSchema>

export const SchoolsDataSchema = z.object({
	t: z.iso.datetime(), // changed at
	g: z.array(GeoNodeSchema), // geo tree
	s: z.array(SchoolSchema), // schools
})

export type SchoolsData = z.infer<typeof SchoolsDataSchema>
