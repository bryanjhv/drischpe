import { PATHS } from './lib/io.ts'
import { fetchRecords } from './lib/mtc.ts'
import { writeRecords } from './lib/records.ts'

const records = await fetchRecords()
await writeRecords(PATHS.next, records)
console.log(`Pulled ${records.length} records from MTC`)
