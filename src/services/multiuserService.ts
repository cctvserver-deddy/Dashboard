/// <reference types="vite/client" />
import Papa from "papaparse";

export interface AppInstance {
  id: string;
  ulName: string;
  spreadsheetId: string;
  gasWebUrl: string;
  status: 'pending' | 'active';
  createdAt: string;
}

export class MultiuserService {
  private static STORAGE_KEY = "pln_multiuser_apps";
  private static OVERRIDE_PREFIX = "pln_sheet_override_";

  // Pre-configured default master application
  private static MASTER_APP: AppInstance = {
    id: "master",
    ulName: "BUKITTINGGI",
    spreadsheetId: "1CXQHbSse7jic16s5hZwzSQl8MbDSAy9nBUKr5Z8ACVE",
    gasWebUrl: "https://script.google.com/macros/s/AKfycby-sample/exec",
    status: "active",
    createdAt: "2026-06-01T00:00:00Z"
  };

  /**
   * Retrieves all registered applications from localStorage
   */
  public static getApplications(): AppInstance[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        // Seed default master app
        const defaults = [this.MASTER_APP];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(defaults));
        return defaults;
      }
      const parsed = JSON.parse(stored) as AppInstance[];
      // Ensure master is always present
      if (!parsed.some(app => app.id === "master")) {
        parsed.unshift(this.MASTER_APP);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse multiuser apps list:", e);
      return [this.MASTER_APP];
    }
  }

  /**
   * Saves application list
   */
  public static saveApplications(apps: AppInstance[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(apps));
    this.pushApplicationsToRemote(apps);
  }

  /**
   * Fetches remote applications from Google Sheets tab REGISTRASI
   */
  public static async fetchRemoteApplications(): Promise<AppInstance[]> {
    const gasUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
    if (!gasUrl) {
      return this.getApplications();
    }

    try {
      const sId = "1CXQHbSse7jic16s5hZwzSQl8MbDSAy9nBUKr5Z8ACVE";
      const sheetName = "REGISTRASI";
      const endpoints = [
        `https://docs.google.com/spreadsheets/d/${sId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`,
        `https://docs.google.com/spreadsheets/d/${sId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`,
        `https://docs.google.com/spreadsheets/d/${sId}/pub?output=csv&sheet=${encodeURIComponent(sheetName)}`,
        `${gasUrl}?sheet=${encodeURIComponent(sheetName)}`
      ];

      let csvText = "";
      for (const url of endpoints) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            const text = await res.text();
            if (text && !text.trim().startsWith("<!DOCTYPE html>") && !text.includes("<html") && !text.includes("google-signin")) {
              csvText = text;
              break;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (!csvText) {
        return this.getApplications();
      }

      const parsed = Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true
      });

      const rows = parsed.data as string[][];
      if (rows.length <= 1) {
        return this.getApplications();
      }

      const apps: AppInstance[] = [this.MASTER_APP];
      const startIdx = (rows[0][0] || "").toLowerCase().includes("id") ? 1 : 0;

      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 5) continue;
        const id = String(row[0] || "").trim();
        const ulName = String(row[1] || "").trim();
        const spreadsheetId = String(row[2] || "").trim();
        const gasWebUrl = String(row[3] || "").trim();
        const status = String(row[4] || "").trim() === "active" ? "active" : "pending";
        const createdAt = String(row[5] || row[4] || "").trim();

        if (id && id !== "master" && id !== "ID") {
          if (!apps.some(a => a.id === id)) {
            apps.push({
              id,
              ulName,
              spreadsheetId,
              gasWebUrl,
              status,
              createdAt: createdAt || new Date().toISOString()
            });
          }
        }
      }

      // Merge remote with local to protect any offline additions or activation status changes
      const localApps = this.getApplications();
      let hasNewLocal = false;
      localApps.forEach(localApp => {
        const idx = apps.findIndex(remoteApp => remoteApp.id === localApp.id);
        if (idx === -1) {
          apps.push(localApp);
          hasNewLocal = true;
        } else {
          // If status or details are different in local storage, we preserve the local state 
          // (which is the source of truth when the Master admin changes activation status)
          const remoteApp = apps[idx];
          if (remoteApp.status !== localApp.status || remoteApp.spreadsheetId !== localApp.spreadsheetId || remoteApp.gasWebUrl !== localApp.gasWebUrl) {
            apps[idx] = {
              ...remoteApp,
              status: localApp.status,
              spreadsheetId: localApp.spreadsheetId,
              gasWebUrl: localApp.gasWebUrl,
              ulName: localApp.ulName
            };
            hasNewLocal = true;
          }
        }
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(apps));
      
      if (hasNewLocal) {
        this.pushApplicationsToRemote(apps);
      }

      return apps;
    } catch (e) {
      console.error("Failed to fetch remote registered apps:", e);
      return this.getApplications();
    }
  }

  /**
   * Pushes current applications to remote Google Sheets tab
   */
  public static async pushApplicationsToRemote(appsToPush?: AppInstance[]): Promise<boolean> {
    const gasUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
    if (!gasUrl) {
      return false;
    }

    try {
      const allApps = appsToPush || this.getApplications();
      const sheetName = "REGISTRASI";
      const rows: string[][] = [
        ["ID", "Nama ULP", "Spreadsheet ID", "GAS Web URL", "Status", "Created At"]
      ];

      allApps.forEach(app => {
        if (app.id !== "master") {
          rows.push([
            app.id,
            app.ulName,
            app.spreadsheetId,
            app.gasWebUrl,
            app.status,
            app.createdAt
          ]);
        }
      });

      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify({
          sheet: sheetName,
          rows: rows,
          append: false
        })
      });

      return true;
    } catch (e) {
      console.error("Failed to push apps list to remote:", e);
      return false;
    }
  }

  /**
   * Safe retrieval of a single application by ID
   */
  public static getApplication(id: string): AppInstance | null {
    const apps = this.getApplications();
    return apps.find(app => app.id === id) || null;
  }

  /**
   * Extract spreadsheet ID from link (Google Drive / Sheets link)
   */
  public static extractSpreadsheetId(link: string): string {
    if (!link) return "";
    // Match /spreadsheets/d/([a-zA-Z0-9-_]+)
    const matches = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
      return matches[1];
    }
    // Match direct ID or return trimmed string
    const trimmed = link.trim();
    if (trimmed.length > 20 && !trimmed.includes("/") && !trimmed.includes(".")) {
      return trimmed;
    }
    // Fallback search param
    try {
      const url = new URL(trimmed);
      const idParam = url.searchParams.get("id");
      if (idParam) return idParam;
    } catch {
      // Ignored
    }
    return trimmed; // Return raw as fallback
  }

  /**
   * Generates a slug-based ID from the Unit name, prefixing it with 'app-'
   * Example: "UL SOLOK" -> "app-solok"
   * Example: "ULP PADANG PANJANG" -> "app-padang-panjang"
   */
  public static generateAppIdFromUlName(ulName: string): string {
    const raw = String(ulName || "").trim().toUpperCase();
    // Strip prefixes like "ULP ", "UL ", "UP3 " (case-insensitive)
    let clean = raw.replace(/^(ULP|UL|UP3)\s+/i, "").trim();
    if (!clean) clean = raw; // fallback in case only "UL" was entered
    
    const slug = clean
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-") // replace anything not alphanumeric with hyphen
      .replace(/-+/g, "-")         // remove duplicate hyphens
      .replace(/^-|-$/g, "");      // trim hyphens from ends
      
    return "app-" + (slug || "unit");
  }

  /**
   * Register a new sub-app. Initially "pending" status as requested
   */
  public static registerApplication(ulName: string, driveLink: string, gasWebUrl: string = ""): AppInstance {
    const rawName = String(ulName || "").trim().toUpperCase();
    const id = this.generateAppIdFromUlName(rawName);
    const spreadsheetId = this.extractSpreadsheetId(driveLink);

    const apps = this.getApplications();
    const existingIndex = apps.findIndex(app => app.id === id);

    const newApp: AppInstance = {
      id,
      ulName: rawName || "UL BARU",
      spreadsheetId: spreadsheetId || "1CXQHbSse7jic16s5hZwzSQl8MbDSAy9nBUKr5Z8ACVE", // Use master spreadsheet as template fallback
      gasWebUrl: gasWebUrl.trim(),
      status: "pending", // ALWAYS pending upon install until Master Admin activates in Tab AKSES
      createdAt: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      // Overwrite/Update existing instance to avoid duplicate ID issues
      apps[existingIndex] = newApp;
    } else {
      apps.push(newApp);
    }

    this.saveApplications(apps);
    return newApp;
  }

  /**
   * Update activation status of an application
   */
  public static activateApplication(id: string, active: boolean): boolean {
    if (id === "master") return true; // Master App is always active
    const apps = this.getApplications();
    const index = apps.findIndex(app => app.id === id);
    if (index !== -1) {
      apps[index].status = active ? "active" : "pending";
      this.saveApplications(apps);
      return true;
    }
    return false;
  }

  /**
   * Save uploaded CSV override for a particular sheet on a sub-app
   */
  public static saveSheetOverride(appId: string, sheetName: string, csvText: string): boolean {
    try {
      localStorage.setItem(`${this.OVERRIDE_PREFIX}${appId}_${sheetName.toUpperCase()}`, csvText);
      return true;
    } catch (e) {
      console.error(`Failed to store override for ${sheetName}:`, e);
      return false;
    }
  }

  /**
   * Get uploaded CSV override rows for a particular sheet on a sub-app
   */
  public static getSheetOverride(appId: string, sheetName: string): any[][] | null {
    try {
      const stored = localStorage.getItem(`${this.OVERRIDE_PREFIX}${appId}_${sheetName.toUpperCase()}`);
      if (!stored) return null;
      
      const parsed = Papa.parse(stored, {
        header: false,
        skipEmptyLines: true
      });
      return parsed.data as any[][];
    } catch {
      return null;
    }
  }

  /**
   * Clear all uploaded overrides for a sub-app to reset back to Google Sheets standard
   */
  public static clearSheetOverrides(appId: string): void {
    const sheets = ["CCTV_DATA", "WO", "PO", "POSKO", "PETUGAS", "ULP"];
    sheets.forEach(sheet => {
      localStorage.removeItem(`${this.OVERRIDE_PREFIX}${appId}_${sheet.toUpperCase()}`);
    });
  }

  /**
   * Dynamically replace all "Bukittinggi" / "BUKITTINGGI" references in text with custom UL Name
   */
  public static replaceBrandingText(text: string, currentUlName: string): string {
    if (!text) return "";
    if (!currentUlName || currentUlName.toUpperCase() === "BUKITTINGGI") return text;
    
    // Normalize custom UL Name
    let customUlp = currentUlName.toUpperCase().replace(/^ULP\s+/i, "").replace(/^UL\s+/i, "").trim();
    let customUlpCased = currentUlName.replace(/^ulp\s+/i, "").replace(/^ul\s+/i, "").trim();

    // Replace sequences
    return text
      .replace(/UL BUKITTINGGI/g, "UL " + customUlp)
      .replace(/ULP BUKITTINGGI/g, "ULP " + customUlp)
      .replace(/UP3 BUKITTINGGI/g, "UP3 " + customUlp)
      .replace(/Bukittinggi/g, customUlpCased)
      .replace(/BUKITTINGGI/g, customUlp);
  }

  /**
   * Generates tailored Google Apps Script code to deploy to the user's spreadsheet,
   * replacing references based on their UL Name!
   */
  public static generateAppsScriptCode(ulName: string): string {
    const customUl = String(ulName || "PADANG").toUpperCase();
    return `/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT (GAS) - PLN MULTIUSER DASHBOARD CONNECTOR
 * UNIT LAYANAN: UL ${customUl}
 * ==============================================================================
 * 
 * Lakukan langkah-langkah berikut untuk mendeploy script ini:
 * 1. Di Google Sheet Anda, klik Extensions > Apps Script.
 * 2. Hapus semua file / kode default, lalu paste kode ini.
 * 3. Simpan proyek script (ikon disket atau Ctrl + S).
 * 4. Klik tombol "Deploy" di kanan atas > "New deployment".
 * 5. Pilih "Web app" sebagai deployment type.
 * 6. Ubah "Execute as" menjadi "Me" dan "Who has access" menjadi "Anyone".
 * 7. Klik "Deploy", beri izin akses jika diminta (Authorize / Advanced > Go to Untitled Project).
 * 8. Copy "Web App URL" hasil deploy dan masukkan ke kolom "Link Web App GAS" di aplikasi.
 */

// Konfigurasi Unit Wilayah
const UNIT_WILAYAH = "UL ${customUl}";

function doGet(e) {
  const sheetName = e && e.parameter && e.parameter.sheet ? e.parameter.sheet : "";
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!sheetName) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "connected", 
      unit: UNIT_WILAYAH,
      sheets: spreadsheet.getSheets().map(s => s.getName())
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: "Sheet not found: " + sheetName 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  // Return parsed CSV data
  let csvText = "";
  for (let r = 0; r < values.length; r++) {
    const row = values[r].map(cell => {
      if (cell instanceof Date) {
        return "Date(" + cell.getFullYear() + "," + cell.getMonth() + "," + cell.getDate() + "," + cell.getHours() + "," + cell.getMinutes() + "," + cell.getSeconds() + ")";
      }
      let valStr = String(cell);
      if (valStr.includes(",") || valStr.includes('"') || valStr.includes("\\n") || valStr.includes(";")) {
        valStr = '"' + valStr.replace(/"/g, '""') + '"';
      }
      return valStr;
    });
    csvText += row.join(",") + "\\n";
  }
  
  return ContentService.createTextOutput(csvText).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const sheetName = params.sheet;
    const rows = params.rows; // Array of arrays
    const isAppend = params.append || false;
    
    if (!sheetName || !rows || !Array.isArray(rows)) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Missing parameters" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    
    if (!isAppend) {
      sheet.clear();
    }
    
    if (rows.length > 0) {
      const startRow = isAppend ? sheet.getLastRow() + 1 : 1;
      const numRows = rows.length;
      const numCols = rows[0].length;
      sheet.getRange(startRow, 1, numRows, numCols).setValues(rows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      message: "Data successfully synced to sheet " + sheetName 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
  }
}
