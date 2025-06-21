// Updated SHACL Generator with label lookup, customizable cardinalities, and validation comments

import { useState, useEffect } from "react"
import { Parser, Store, DataFactory, Writer } from "n3"

export default function ShaclGenerator() {
  const [ttlInput, setTtlInput] = useState("")
  const [store, setStore] = useState(null)
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState("")
  const [properties, setProperties] = useState([])
  const [selectedProps, setSelectedProps] = useState([])
  const [shaclOutput, setShaclOutput] = useState("")

  const [cardinalities, setCardinalities] = useState({})
  const [comments, setComments] = useState({})
  const [labels, setLabels] = useState({})

  const parseOntology = () => {
    const parser = new Parser()
    const quads = parser.parse(ttlInput)
    const s = new Store(quads)
    setStore(s)

    const classSet = new Set()
    const propList = []
    const labelMap = {}

    s.getQuads(null, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#Class", null)
      .forEach(q => classSet.add(q.subject.id))

    s.getQuads(null, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", null, null).forEach(q => {
      if (q.object.id.includes("Property")) {
        propList.push(q.subject.id)
      }
    })

    s.getQuads(null, "http://www.w3.org/2000/01/rdf-schema#label", null, null).forEach(q => {
      labelMap[q.subject.id] = q.object.value
    })

    setClasses(Array.from(classSet))
    setProperties(propList)
    setLabels(labelMap)
  }

  const generateSHACL = () => {
    const writer = new Writer({ prefixes: { sh: "http://www.w3.org/ns/shacl#", ex: "http://example.org/" } })
    const shapeName = `ex:${selectedClass.split(/[#/]/).pop()}Shape`
    writer.addQuad(DataFactory.namedNode(shapeName), DataFactory.namedNode("http://www.w3.org/ns/shacl#targetClass"), DataFactory.namedNode(selectedClass))

    selectedProps.forEach(prop => {
      const b = DataFactory.blankNode()
      writer.addQuad(DataFactory.namedNode(shapeName), DataFactory.namedNode("http://www.w3.org/ns/shacl#property"), b)
      writer.addQuad(b, DataFactory.namedNode("http://www.w3.org/ns/shacl#path"), DataFactory.namedNode(prop))

      const card = cardinalities[prop] || { min: "0", max: "" }
      if (card.min) {
        writer.addQuad(b, DataFactory.namedNode("http://www.w3.org/ns/shacl#minCount"), DataFactory.literal(card.min, DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#integer")))
      }
      if (card.max) {
        writer.addQuad(b, DataFactory.namedNode("http://www.w3.org/ns/shacl#maxCount"), DataFactory.literal(card.max, DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#integer")))
      }

      if (comments[prop]) {
        writer.addQuad(b, DataFactory.namedNode("http://www.w3.org/ns/shacl#message"), DataFactory.literal(comments[prop]))
      }
    })

    writer.end((error, result) => setShaclOutput(result))
  }

  const handleFileUpload = async (e) => {
    const text = await e.target.files[0].text()
    setTtlInput(text)
  }

  const toggleProp = (prop) => {
    setSelectedProps(prev => prev.includes(prop) ? prev.filter(p => p !== prop) : [...prev, prop])
  }

  const updateCardinality = (prop, type, value) => {
    setCardinalities(prev => ({
      ...prev,
      [prop]: {
        ...prev[prop],
        [type]: value
      }
    }))
  }

  const updateComment = (prop, value) => {
    setComments(prev => ({ ...prev, [prop]: value }))
  }

  const downloadTTL = () => {
    const blob = new Blob([shaclOutput], { type: "text/turtle" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "shapes.ttl"
    a.click()
  }

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h2>Upload Ontology File (.ttl)</h2>
      <input type="file" accept=".ttl" onChange={handleFileUpload} />
      <button onClick={parseOntology}>Parse Ontology</button>

      <h2 style={{ marginTop: "1rem" }}>Select Class</h2>
      <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
        <option value="">-- Select --</option>
        {classes.map(c => (
          <option key={c} value={c}>
            {labels[c] ? `${c} (${labels[c]})` : c}
          </option>
        ))}
      </select>

      <h2 style={{ marginTop: "1rem" }}>Select Properties</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {properties.map(p => (
          <div key={p} style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
            <label>
              <input type="checkbox" checked={selectedProps.includes(p)} onChange={() => toggleProp(p)} />
              {labels[p] ? ` ${labels[p]} (${p})` : ` ${p}`}
            </label>
            {selectedProps.includes(p) && (
              <div style={{ marginTop: "0.5rem" }}>
                <label>minCount: <input type="number" value={cardinalities[p]?.min || ""} onChange={e => updateCardinality(p, "min", e.target.value)} /></label>
                <label style={{ marginLeft: "1rem" }}>maxCount: <input type="number" value={cardinalities[p]?.max || ""} onChange={e => updateCardinality(p, "max", e.target.value)} /></label>
                <br />
                <label>Validation message: <input type="text" value={comments[p] || ""} onChange={e => updateComment(p, e.target.value)} style={{ width: "60%" }} /></label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button onClick={generateSHACL} disabled={!selectedClass || selectedProps.length === 0}>Generate SHACL</button>
      </div>

      <h2 style={{ marginTop: "1rem" }}>SHACL Turtle Output</h2>
      <textarea value={shaclOutput} rows={12} cols={100} readOnly style={{ fontFamily: "monospace" }} />

      <div>
        <button onClick={downloadTTL} disabled={!shaclOutput}>Download TTL</button>
      </div>
    </div>
  )
} 
