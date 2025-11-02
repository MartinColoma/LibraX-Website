const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");

// ====================
// 🔹 MARC Parsing Dependencies
// ====================
const storage = multer.memoryStorage(); // store files in memory
const upload = multer({ storage });
const { Readable } = require("stream");
const marcjs = require("marcjs"); 

// ====================
// 🔹 Env Validation
// ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ====================
// 🔹 ID Generators
// ====================
const generateIntId = () =>
  parseInt(uuidv4().replace(/-/g, "").slice(0, 8), 16) % 2_000_000_000;

const generateBookId = () => uuidv4().replace(/-/g, "").slice(0, 11);

// ====================
// 🔹 MARCJS ARRAY FORMAT HELPERS
// ====================
// marcjs returns fields as flat arrays: ["245", "14", "a", "Title", "b", "Subtitle"]

/**
 * Get control field value (001, 005, 008)
 * Format: ["001", "13798376"]
 */
function getControlField(record, tag) {
  try {
    if (!record || !record.fields || !Array.isArray(record.fields)) return "";
    
    const field = record.fields.find(f => Array.isArray(f) && f[0] === tag);
    if (!field || field.length < 2) return "";
    
    return String(field[1] || "").trim();
  } catch (err) {
    console.error(`❌ Error extracting control field ${tag}:`, err.message);
    return "";
  }
}

/**
 * Get data field with specific subfield
 * Format: ["245", "14", "a", "The broker /", "c", "John Grisham."]
 */
function getField(record, tag, subfield = null) {
  try {
    if (!record || !record.fields || !Array.isArray(record.fields)) return "";
    
    // Find all fields with matching tag
    const matchingFields = record.fields.filter(f => 
      Array.isArray(f) && f.length > 2 && f[0] === tag
    );
    
    if (matchingFields.length === 0) return "";
    
    const values = [];
    
    for (const field of matchingFields) {
      // field[0] = tag, field[1] = indicators, field[2+] = alternating codes and values
      
      if (subfield) {
        // Extract specific subfield
        for (let i = 2; i < field.length; i += 2) {
          if (field[i] === subfield && field[i + 1]) {
            values.push(String(field[i + 1]).trim());
          }
        }
      } else {
        // No subfield - concatenate all values (skip codes)
        for (let i = 3; i < field.length; i += 2) {
          if (field[i]) {
            values.push(String(field[i]).trim());
          }
        }
      }
    }
    
    return values.join(" ").trim();
  } catch (err) {
    console.error(`❌ Error extracting ${tag}${subfield ? `$${subfield}` : ""}:`, err.message);
    return "";
  }
}

/**
 * Get all occurrences of a specific subfield
 */
function getAllFieldValues(record, tag, subfield) {
  try {
    if (!record || !record.fields || !Array.isArray(record.fields)) return [];
    
    const matchingFields = record.fields.filter(f => 
      Array.isArray(f) && f.length > 2 && f[0] === tag
    );
    
    const values = [];
    
    for (const field of matchingFields) {
      for (let i = 2; i < field.length; i += 2) {
        if (field[i] === subfield && field[i + 1]) {
          const value = String(field[i + 1]).trim();
          if (value) values.push(value);
        }
      }
    }
    
    return values;
  } catch (err) {
    console.error(`❌ Error extracting all ${tag}$${subfield}:`, err.message);
    return [];
  }
}

/**
 * Extract all authors
 */
function extractAuthors(record) {
  try {
    const authors = [];
    
    // Main author (100 or 110)
    const mainAuthor = getField(record, "100", "a") || getField(record, "110", "a");
    if (mainAuthor) {
      authors.push(cleanText(mainAuthor));
    }
    
    // Additional authors (700$a)
    const additionalAuthors = getAllFieldValues(record, "700", "a");
    for (const author of additionalAuthors) {
      const cleaned = cleanText(author);
      if (cleaned && !authors.includes(cleaned)) {
        authors.push(cleaned);
      }
    }
    
    return authors;
  } catch (err) {
    console.error("❌ Error extracting authors:", err.message);
    return [];
  }
}

// ====================
// 🔹 Text Cleaning Helpers
// ====================
function cleanText(text) {
  if (!text) return "";
  return String(text).replace(/[\/.:,;]+$/, "").trim();
}

function cleanPublisher(publisher) {
  if (!publisher) return "";
  return publisher.replace(/[,:;]+$/, "").trim();
}

function cleanISBN(isbn) {
  if (!isbn) return "";
  const cleaned = isbn.split(/[\s(]/)[0].trim();
  return cleaned.replace(/[-\s]/g, '').match(/\d{10,13}/)?.[0] || cleaned;
}

function extractYear(dateString) {
  if (!dateString) return "";
  const yearMatch = String(dateString).match(/\d{4}/);
  return yearMatch ? yearMatch[0] : "";
}

module.exports = (app) => {
  const router = express.Router();
  router.use(express.json({ limit: "5mb" }));

  // ====================
  // 🔹 GET Categories
  // ====================
  router.get("/categories", async (req, res) => {
    try {
      const { data, error } = await supabase.from("categories").select("*");
      if (error) throw error;
      res.status(200).json({ categories: data });
    } catch (err) {
      console.error("❌ Error fetching categories:", err);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // ====================
  // 🔹 GET Authors
  // ====================
  router.get("/authors", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("authors")
        .select("author_id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      res.status(200).json({ authors: data });
    } catch (err) {
      console.error("❌ Error fetching authors:", err);
      res.status(500).json({ message: "Failed to fetch authors" });
    }
  });

  // ====================
  // 🔹 POST New Book (NFC-aware)
  // ====================
  router.post("/", async (req, res) => {
    try {
      const {
        isbn,
        title,
        subtitle,
        description,
        publisher,
        publicationYear,
        edition,
        language,
        categoryId,
        authors,
        copies,
        nfcUids = [],
      } = req.body;

      if (!title) return res.status(400).json({ message: "Title is required" });

      console.log("📘 Adding new book:", title);

      const bookId = generateBookId();
      const totalCopies = copies && copies > 0 ? copies : 1;

      const { error: bookError } = await supabase.from("books").insert([
        {
          book_id: bookId,
          isbn,
          title,
          subtitle,
          description,
          publisher,
          publication_year: publicationYear,
          edition,
          language,
          category_id: categoryId,
          total_copies: totalCopies,
          available_copies: totalCopies,
        },
      ]);
      if (bookError) throw bookError;

      const authorIds = [];
      for (const name of authors || []) {
        if (!name.trim()) continue;

        const { data: existing, error: checkErr } = await supabase
          .from("authors")
          .select("author_id")
          .ilike("name", name.trim())
          .maybeSingle();
        if (checkErr) throw checkErr;

        let authorId;
        if (existing) authorId = existing.author_id;
        else {
          const newId = generateIntId();
          const { data: inserted, error: insertErr } = await supabase
            .from("authors")
            .insert([{ author_id: newId, name: name.trim() }])
            .select()
            .single();
          if (insertErr) throw insertErr;
          authorId = inserted.author_id;
        }
        authorIds.push(authorId);
      }

      for (const id of authorIds) {
        const { error: mapErr } = await supabase
          .from("book_authors")
          .upsert([{ book_id: bookId, author_id: id }]);
        if (mapErr) throw mapErr;
      }

      const copiesToInsert = [];
      for (let i = 0; i < totalCopies; i++) {
        const suffix = String(i + 1).padStart(5, "0");
        copiesToInsert.push({
          copy_id: `${bookId}${suffix}`,
          book_id: bookId,
          nfc_uid: nfcUids[i] || null,
        });
      }

      const { error: copyError } = await supabase
        .from("book_copies")
        .insert(copiesToInsert);
      if (copyError) throw copyError;

      res.status(200).json({
        message: "✅ Book successfully added!",
        bookId,
        copiesAdded: copiesToInsert.length,
      });
    } catch (err) {
      console.error("❌ Error adding book:", err);
      res.status(500).json({ message: err.message || "Internal server error" });
    }
  });


// ====================
// 🔹 UNIVERSAL MARC PARSER - Supports All Formats
// ====================
const marcjs = require("marcjs");
const { parseString } = require("xml2js");
const iconv = require("iconv-lite");

// ====================
// 🔹 Detect MARC Format
// ====================
function detectMARCFormat(buffer) {
  const preview = buffer.slice(0, 100).toString('utf8', 0, 100);
  const hexPreview = buffer.slice(0, 10).toString('hex');
  
  // Check for MARCXML
  if (preview.includes('<?xml') || preview.includes('<collection') || preview.includes('<record')) {
    return 'MARCXML';
  }
  
  // Check for JSON
  if (preview.trim().startsWith('{') || preview.trim().startsWith('[')) {
    return 'JSON';
  }
  
  // Check for line-delimited MARC (MRK format)
  if (preview.includes('=LDR') || preview.includes('=001') || preview.match(/^=\d{3}/m)) {
    return 'MRK';
  }
  
  // Check if first 5 chars are digits (MARC21 binary record length)
  const firstFive = buffer.toString('utf8', 0, 5);
  if (/^\d{5}$/.test(firstFive)) {
    // Check encoding - MARC-8 vs UTF-8
    const leader = buffer.slice(0, 24).toString('utf8');
    if (leader.length >= 9 && leader[9] === 'a') {
      return 'MARC21_UTF8';
    }
    return 'MARC21_MARC8';
  }
  
  // Check for ISO 2709 structure with different encoding
  if (buffer.length >= 24) {
    const possibleLength = parseInt(buffer.toString('ascii', 0, 5), 10);
    if (!isNaN(possibleLength) && possibleLength > 0 && possibleLength < buffer.length + 1000) {
      return 'MARC21_BINARY';
    }
  }
  
  return 'UNKNOWN';
}

// ====================
// 🔹 Parse MARC21 Binary (MARC-8 or UTF-8)
// ====================
function parseMARCBinary(buffer, encoding = 'binary') {
  return new Promise((resolve, reject) => {
    try {
      const records = [];
      let pos = 0;
      
      while (pos < buffer.length) {
        // Skip any trailing whitespace or padding
        while (pos < buffer.length && buffer[pos] <= 32) {
          pos++;
        }
        
        if (pos + 5 > buffer.length) break;
        
        // Read record length
        const lengthStr = buffer.toString('ascii', pos, pos + 5);
        const recordLength = parseInt(lengthStr, 10);
        
        if (isNaN(recordLength) || recordLength === 0) {
          console.warn(`Invalid record length at position ${pos}: "${lengthStr}"`);
          break;
        }
        
        if (pos + recordLength > buffer.length) {
          console.warn(`Record length ${recordLength} exceeds buffer at position ${pos}`);
          break;
        }
        
        // Extract record
        const recordBuffer = buffer.slice(pos, pos + recordLength);
        
        try {
          // Convert to appropriate encoding
          let marcString;
          if (encoding === 'utf8') {
            marcString = recordBuffer.toString('utf8');
          } else if (encoding === 'marc8') {
            // MARC-8 to UTF-8 conversion using iconv-lite
            marcString = iconv.decode(recordBuffer, 'ISO-8859-1');
          } else {
            // Binary/ISO-8859-1
            marcString = recordBuffer.toString('binary');
          }
          
          // Parse with marcjs
          const reader = new marcjs.Iso2709Reader(marcString);
          const record = reader.next();
          
          if (record && record.fields && record.fields.length > 0) {
            records.push(record);
          }
        } catch (err) {
          console.warn(`Failed to parse record at position ${pos}:`, err.message);
        }
        
        pos += recordLength;
      }
      
      if (records.length === 0) {
        reject(new Error('No valid MARC records found in binary format'));
      } else {
        resolve(records);
      }
      
    } catch (err) {
      reject(new Error(`Binary MARC parsing failed: ${err.message}`));
    }
  });
}

// ====================
// 🔹 Parse MARCXML
// ====================
function parseMARCXML(buffer) {
  return new Promise((resolve, reject) => {
    try {
      const xmlString = buffer.toString('utf8');
      
      parseString(xmlString, { explicitArray: false, trim: true }, (err, result) => {
        if (err) {
          return reject(new Error(`XML parsing failed: ${err.message}`));
        }
        
        try {
          const records = [];
          
          // Handle different MARCXML structures
          let marcRecords = [];
          if (result.collection && result.collection.record) {
            marcRecords = Array.isArray(result.collection.record) 
              ? result.collection.record 
              : [result.collection.record];
          } else if (result.record) {
            marcRecords = Array.isArray(result.record) ? result.record : [result.record];
          } else if (result.records && result.records.record) {
            marcRecords = Array.isArray(result.records.record)
              ? result.records.record
              : [result.records.record];
          }
          
          for (const xmlRecord of marcRecords) {
            const record = convertXMLToMARC(xmlRecord);
            if (record) {
              records.push(record);
            }
          }
          
          if (records.length === 0) {
            reject(new Error('No valid records found in MARCXML'));
          } else {
            resolve(records);
          }
        } catch (err) {
          reject(new Error(`MARCXML conversion failed: ${err.message}`));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Convert MARCXML structure to marcjs format
function convertXMLToMARC(xmlRecord) {
  try {
    const record = {
      leader: xmlRecord.leader || '00000nam a2200000 a 4500',
      fields: []
    };
    
    if (!xmlRecord.controlfield && !xmlRecord.datafield) {
      return null;
    }
    
    // Control fields
    const controlFields = Array.isArray(xmlRecord.controlfield)
      ? xmlRecord.controlfield
      : xmlRecord.controlfield ? [xmlRecord.controlfield] : [];
      
    for (const cf of controlFields) {
      if (cf.$ && cf.$.tag) {
        record.fields.push([cf.$.tag, cf._ || '']);
      }
    }
    
    // Data fields
    const dataFields = Array.isArray(xmlRecord.datafield)
      ? xmlRecord.datafield
      : xmlRecord.datafield ? [xmlRecord.datafield] : [];
      
    for (const df of dataFields) {
      if (!df.$ || !df.$.tag) continue;
      
      const tag = df.$.tag;
      const ind1 = df.$.ind1 || ' ';
      const ind2 = df.$.ind2 || ' ';
      const indicators = ind1 + ind2;
      
      const field = [tag, indicators];
      
      const subfields = Array.isArray(df.subfield)
        ? df.subfield
        : df.subfield ? [df.subfield] : [];
        
      for (const sf of subfields) {
        if (sf.$ && sf.$.code) {
          field.push(sf.$.code, sf._ || '');
        }
      }
      
      record.fields.push(field);
    }
    
    return record;
  } catch (err) {
    console.error('Error converting XML record:', err);
    return null;
  }
}

// ====================
// 🔹 Parse Line-Delimited MARC (MRK format)
// ====================
function parseMRK(buffer) {
  return new Promise((resolve, reject) => {
    try {
      const text = buffer.toString('utf8');
      const lines = text.split(/\r?\n/);
      const records = [];
      let currentRecord = null;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // New record starts with =LDR
        if (trimmed.startsWith('=LDR')) {
          if (currentRecord) {
            records.push(currentRecord);
          }
          currentRecord = {
            leader: trimmed.substring(5).trim() || '00000nam a2200000 a 4500',
            fields: []
          };
          continue;
        }
        
        // Field line: =XXX  indicators$aValue$bValue
        const match = trimmed.match(/^=(\d{3})\s+(.*)$/);
        if (match && currentRecord) {
          const tag = match[1];
          const content = match[2];
          
          if (parseInt(tag) < 10) {
            // Control field
            currentRecord.fields.push([tag, content]);
          } else {
            // Data field
            const indicators = content.substring(0, 2) || '  ';
            const subfieldData = content.substring(2);
            
            const field = [tag, indicators];
            
            // Parse subfields
            const subfields = subfieldData.split('$').slice(1);
            for (const sf of subfields) {
              if (sf.length > 0) {
                field.push(sf[0], sf.substring(1));
              }
            }
            
            currentRecord.fields.push(field);
          }
        }
      }
      
      // Add last record
      if (currentRecord) {
        records.push(currentRecord);
      }
      
      if (records.length === 0) {
        reject(new Error('No valid records found in MRK format'));
      } else {
        resolve(records);
      }
      
    } catch (err) {
      reject(new Error(`MRK parsing failed: ${err.message}`));
    }
  });
}

// ====================
// 🔹 Parse MARC JSON
// ====================
function parseMARCJSON(buffer) {
  return new Promise((resolve, reject) => {
    try {
      const jsonString = buffer.toString('utf8');
      const data = JSON.parse(jsonString);
      
      const records = Array.isArray(data) ? data : [data];
      
      // Validate and normalize
      const validRecords = records.filter(r => 
        r && typeof r === 'object' && r.fields && Array.isArray(r.fields)
      );
      
      if (validRecords.length === 0) {
        reject(new Error('No valid records found in JSON format'));
      } else {
        resolve(validRecords);
      }
      
    } catch (err) {
      reject(new Error(`JSON parsing failed: ${err.message}`));
    }
  });
}

// ====================
// 🔹 UNIVERSAL PARSE FUNCTION
// ====================
async function parseUniversalMARC(buffer) {
  const format = detectMARCFormat(buffer);
  
  console.log(`📋 Detected format: ${format}`);
  
  try {
    switch (format) {
      case 'MARCXML':
        return await parseMARCXML(buffer);
        
      case 'MARC21_UTF8':
        return await parseMARCBinary(buffer, 'utf8');
        
      case 'MARC21_MARC8':
      case 'MARC21_BINARY':
        return await parseMARCBinary(buffer, 'binary');
        
      case 'MRK':
        return await parseMRK(buffer);
        
      case 'JSON':
        return await parseMARCJSON(buffer);
        
      default:
        // Try all methods as fallback
        console.log('⚠️ Unknown format, trying all parsers...');
        
        const errors = [];
        
        // Try binary first
        try {
          return await parseMARCBinary(buffer, 'binary');
        } catch (e) {
          errors.push(`Binary: ${e.message}`);
        }
        
        // Try UTF-8
        try {
          return await parseMARCBinary(buffer, 'utf8');
        } catch (e) {
          errors.push(`UTF-8: ${e.message}`);
        }
        
        // Try MARCXML
        try {
          return await parseMARCXML(buffer);
        } catch (e) {
          errors.push(`XML: ${e.message}`);
        }
        
        // Try MRK
        try {
          return await parseMRK(buffer);
        } catch (e) {
          errors.push(`MRK: ${e.message}`);
        }
        
        throw new Error(`All parsing methods failed:\n${errors.join('\n')}`);
    }
  } catch (err) {
    throw err;
  }
}

// ====================
// 🔹 UPDATED ROUTE
// ====================
router.post("/marc", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("\n📄 ========== MARC FILE UPLOAD ==========");
    console.log("File name:", req.file.originalname);
    console.log("File size:", req.file.size, "bytes");
    console.log("File mimetype:", req.file.mimetype);

    if (req.file.size === 0) {
      return res.status(400).json({ message: "Empty file uploaded" });
    }

    // Parse with universal parser
    let parsedRecords;
    try {
      console.log("\n🔄 Parsing MARC file (auto-detecting format)...");
      parsedRecords = await parseUniversalMARC(req.file.buffer);
      console.log(`✅ Successfully parsed ${parsedRecords.length} record(s)`);
    } catch (parseError) {
      console.error("❌ Parsing error:", parseError.message);
      
      return res.status(400).json({ 
        message: "Unable to parse MARC file",
        details: parseError.message,
        supportedFormats: [
          "MARC21 Binary (.mrc, .marc)",
          "MARCXML (.xml)",
          "Line-delimited MARC (.mrk)",
          "MARC JSON",
          "UTF-8 and MARC-8 encodings"
        ]
      });
    }
    
    if (!parsedRecords || parsedRecords.length === 0) {
      return res.status(400).json({ 
        message: "No valid MARC records found in file"
      });
    }

    console.log(`\n📚 Processing ${parsedRecords.length} MARC record(s)`);
    console.log("========================================\n");

    // Extract bibliographic data
    const records = [];
    
    for (let idx = 0; idx < parsedRecords.length; idx++) {
      const record = parsedRecords[idx];
      
      try {
        if (!record?.fields?.length) {
          console.warn(`⚠️ Record ${idx + 1} has no fields, skipping`);
          continue;
        }
        
        // Use your existing extraction logic
        const title = cleanText(getField(record, "245", "a"));
        
        if (!title) {
          console.warn(`⚠️ Record ${idx + 1}: No title found, skipping`);
          continue;
        }
        
        const parsed = {
          title,
          subtitle: cleanText(getField(record, "245", "b")),
          isbn: cleanISBN(getField(record, "020", "a") || getField(record, "020", "z")),
          authors: extractAuthors(record),
          publisher: cleanPublisher(getField(record, "260", "b") || getField(record, "264", "b")),
          publicationYear: extractYear(getField(record, "260", "c") || getField(record, "264", "c")),
          edition: cleanText(getField(record, "250", "a")),
          language: getField(record, "041", "a") || extractLanguageFrom008(record),
          description: getField(record, "520", "a") || getField(record, "500", "a"),
          lcClassification: getField(record, "050", "a"),
          deweyClassification: getField(record, "082", "a"),
          subject: getAllFieldValues(record, "650", "a").map(cleanText).join("; "),
          series: getField(record, "490", "a"),
          notes: getField(record, "500", "a"),
          physicalDescription: getField(record, "300", "a"),
          controlNumber: getControlField(record, "001"),
          lastModified: getControlField(record, "005"),
        };

        records.push(parsed);
        
      } catch (err) {
        console.error(`❌ Error extracting record ${idx + 1}:`, err.message);
      }
    }

    if (records.length === 0) {
      return res.status(400).json({ 
        message: "No usable bibliographic data found"
      });
    }

    console.log(`✅ Extracted ${records.length} of ${parsedRecords.length} record(s)\n`);
    res.status(200).json({ 
      records,
      format: detectMARCFormat(req.file.buffer),
      totalParsed: parsedRecords.length,
      totalExtracted: records.length
    });

  } catch (err) {
    console.error("\n❌ Unexpected error:", err);
    res.status(500).json({ 
      message: "Server error processing MARC file",
      error: err.message
    });
  }
});

// Helper to extract language from 008 field
function extractLanguageFrom008(record) {
  const field008 = getControlField(record, "008");
  if (field008 && field008.length >= 38) {
    return field008.substring(35, 38).trim();
  }
  return "";
}

// Note: getField, getControlField, extractAuthors, cleanText, etc. 
// helper func
  // ====================
  // 🔹 Mount Router
  // ====================
  app.use("/api/librarian/quick_actions/newbooks", router);
};