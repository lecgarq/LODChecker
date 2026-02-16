import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import queue
import re
import subprocess
import threading
import sys
import os
import shutil
from pathlib import Path

# Config bootstrap
ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_ROOT = ROOT_DIR / "04_config"
if str(CONFIG_ROOT) not in sys.path:
    sys.path.append(str(CONFIG_ROOT))
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from config import load_config

CFG = load_config(ROOT_DIR)

# Configuration defaults
DEFAULT_OUT_DIR = str(ROOT_DIR / CFG["paths"]["data_root"])
DEFAULT_PYTHON = str(ROOT_DIR / CFG["paths"]["venv_python_windows"])
SCRIPT_PATH = ROOT_DIR / CFG["paths"]["pipeline_optimized"]
DATA_TOOLS_PATH = ROOT_DIR / CFG["paths"]["data_tools"]
WORKING_DIR = SCRIPT_PATH.parent

class PipelineUI:
    def __init__(self, root):
        self.root = root
        self.root.title("LOD Checker - Super Pipeline v5")
        self.root.geometry("620x750")
        self.process = None
        self.queue = [] 
        self.is_cancelled = False
        self.msg_queue = queue.Queue() 
        self.input_dir = tk.StringVar(value="")
        self.output_dir = tk.StringVar(value=DEFAULT_OUT_DIR)
        
        self.root.configure(bg="#ffffff")
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background="#ffffff")
        style.configure("TLabel", background="#ffffff", foreground="#333333", font=("Segoe UI", 10))
        style.configure("TButton", font=("Segoe UI", 10), background="#f0f0f0", foreground="#333333", borderwidth=1)
        style.map("TButton", background=[("active", "#e5e5e5")])
        style.configure("Horizontal.TProgressbar", background="#4a90e2", borderwidth=0, troughcolor="#f0f0f0")

        main_frame = ttk.Frame(root, padding=30)
        main_frame.pack(fill=tk.BOTH, expand=True)

        self.root.after(100, self.check_queue)

        # TITLE
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        ttk.Label(header_frame, text="LOD Pipeline Orchestrator", font=("Segoe UI", 20, "bold"), foreground="#1a1a1a").pack(anchor="w")
        ttk.Label(header_frame, text="Enriched BIM Classification • Single-File Monolith Logic", font=("Segoe UI", 10), foreground="#888888").pack(anchor="w", pady=(2, 0))

        # INPUT SOURCE
        ttk.Label(main_frame, text="INPUT SOURCE FOLDER", font=("Segoe UI", 9, "bold"), foreground="#999999").pack(anchor="w", pady=(0, 5))
        src_frame = ttk.Frame(main_frame)
        src_frame.pack(fill=tk.X, pady=(0, 15))
        
        self.ent_src = ttk.Entry(src_frame, textvariable=self.input_dir, font=("Segoe UI", 10))
        self.ent_src.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        btn_browse_in = ttk.Button(src_frame, text="Browse...", command=self.browse_input)
        btn_browse_in.pack(side=tk.LEFT)

        # OUTPUT SOURCE
        ttk.Label(main_frame, text="OUTPUT DESTINATION FOLDER", font=("Segoe UI", 9, "bold"), foreground="#999999").pack(anchor="w", pady=(0, 5))
        out_frame = ttk.Frame(main_frame)
        out_frame.pack(fill=tk.X, pady=(0, 20))
        
        self.ent_out = ttk.Entry(out_frame, textvariable=self.output_dir, font=("Segoe UI", 10))
        self.ent_out.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        btn_browse_out = ttk.Button(out_frame, text="Browse...", command=self.browse_output)
        btn_browse_out.pack(side=tk.LEFT)

        # PROGRESS
        prog_frame = ttk.Frame(main_frame)
        prog_frame.pack(fill=tk.X, pady=(0, 15))
        
        info_row = ttk.Frame(prog_frame)
        info_row.pack(fill=tk.X, pady=(0, 5))
        self.lbl_progress = ttk.Label(info_row, text="Waiting to start...", font=("Segoe UI", 10), foreground="#666666")
        self.lbl_progress.pack(side=tk.LEFT)
        self.lbl_eta = ttk.Label(info_row, text="", font=("Segoe UI", 10, "bold"), foreground="#4a90e2")
        self.lbl_eta.pack(side=tk.RIGHT)
        
        self.progress_bar = ttk.Progressbar(prog_frame, orient="horizontal", length=100, mode="determinate", style="Horizontal.TProgressbar")
        self.progress_bar.pack(fill=tk.X)

        # MAIN BUTTONS
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, pady=(10, 20))
        self.btn_run = ttk.Button(btn_frame, text="START PROCESSING", command=self.on_run)
        self.btn_run.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10), ipady=8)
        self.btn_cancel = ttk.Button(btn_frame, text="STOP", command=self.on_cancel, state=tk.DISABLED)
        self.btn_cancel.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=8)

        # DATA MAINTENANCE TOOLS
        tools_frame = ttk.LabelFrame(main_frame, text="Data Maintenance Tools", padding=15)
        tools_frame.pack(fill=tk.X, pady=(0, 20))
        
        self.btn_consolidate = ttk.Button(tools_frame, text="Consolidate Registry", command=lambda: self.run_tool("consolidate"))
        self.btn_consolidate.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        
        self.btn_restore = ttk.Button(tools_frame, text="Restore Embeddings", command=lambda: self.run_tool("restore"))
        self.btn_restore.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))

        # LOGS
        ttk.Label(main_frame, text="PIPELINE LOGS", font=("Segoe UI", 9, "bold"), foreground="#999999").pack(anchor="w", pady=(0, 5))
        self.txt_log = scrolledtext.ScrolledText(main_frame, height=10, bg="#2b2b2b", fg="#e0e0e0", font=("Consolas", 9), relief="flat", borderwidth=1)
        self.txt_log.pack(fill=tk.BOTH, expand=True)

    def browse_input(self):
        folder = filedialog.askdirectory()
        if folder: self.input_dir.set(str(Path(folder).resolve()))

    def browse_output(self):
        folder = filedialog.askdirectory()
        if folder: self.output_dir.set(str(Path(folder).resolve()))

    def log(self, msg):
        self.txt_log.insert(tk.END, msg + "\n")
        self.txt_log.see(tk.END)

    def on_run(self):
        in_p = self.input_dir.get().strip()
        out_p = self.output_dir.get().strip()
        
        if not in_p or not os.path.exists(in_p):
            messagebox.showwarning("Error", "Please select a valid input folder.")
            return
        if not out_p:
            messagebox.showwarning("Error", "Please select an output folder.")
            return

        cmd = [DEFAULT_PYTHON, str(SCRIPT_PATH), "--input", str(in_p), "--output", str(out_p), "--verbose"]
        
        self.log(f"--- STARTING PIPELINE: {in_p} ---")
        self.btn_run.config(state=tk.DISABLED)
        self.btn_cancel.config(state=tk.NORMAL)
        self.progress_bar["value"] = 0
        self.is_cancelled = False
        
        self.thread = threading.Thread(target=self.run_process, args=(cmd,))
        self.thread.start()

    def run_tool(self, tool_type):
        out_p = self.output_dir.get().strip()
        if not out_p:
            messagebox.showwarning("Error", "Please select an output folder to operate on.")
            return

        arg = "--consolidate" if tool_type == "consolidate" else "--restore"
        cmd = [DEFAULT_PYTHON, str(DATA_TOOLS_PATH), "--root", str(out_p), arg]
        
        self.log(f"--- RUNNING TOOL: {tool_type.upper()} on {out_p} ---")
        self.btn_run.config(state=tk.DISABLED)
        self.btn_cancel.config(state=tk.NORMAL)
        self.is_cancelled = False
        
        self.thread = threading.Thread(target=self.run_process, args=(cmd,))
        self.thread.start()

    def run_process(self, cmd):
        try:
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            self.process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", bufsize=1, cwd=WORKING_DIR, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform=="win32" else 0, env=env)
            
            prog_regex = re.compile(r"\[PROGRESS\] (\d+)/(\d+)")
            for line in self.process.stdout:
                line = line.strip()
                if not line: continue
                
                if "ETA:" in line:
                    self.msg_queue.put({"type": "eta", "value": line.split("ETA:")[-1].strip()})
                
                match = prog_regex.search(line)
                if match:
                    c, t = map(int, match.groups())
                    p = (c/t)*100 if t>0 else 0
                    self.msg_queue.put({"type": "progress", "percent": p, "current": c, "total": t})
                elif any(x in line for x in ["[INFO]", "[WARNING]", "[ERROR]"]) or "Error" in line:
                    self.msg_queue.put({"type": "log", "value": line})

            rc = self.process.wait()
            self.msg_queue.put({"type": "log", "value": f"--- PROCESS FINISHED (Exit Code: {rc}) ---"})
        except Exception as e:
            self.msg_queue.put({"type": "log", "value": f"System Error: {e}"})
        finally:
            self.root.after(0, self.on_finished)

    def check_queue(self):
        try:
            while True:
                msg = self.msg_queue.get_nowait()
                if msg["type"] == "log": self.log(msg["value"])
                elif msg["type"] == "eta": self.lbl_eta.config(text=f"ETA: {msg['value']}")
                elif msg["type"] == "progress": self.update_progress(msg["percent"], msg["current"], msg["total"])
        except queue.Empty: pass
        finally: self.root.after(100, self.check_queue)

    def update_progress(self, p, c, t):
        self.progress_bar["value"] = p
        self.lbl_progress.config(text=f"Image {c}/{t} ({int(p)}%)")

    def on_cancel(self):
        if self.process:
            self.is_cancelled = True
            self.process.terminate()
            self.log("Cancel signal sent.")

    def on_finished(self):
        self.btn_run.config(state=tk.NORMAL)
        self.btn_cancel.config(state=tk.DISABLED)
        self.lbl_progress.config(text="Finished/Stopped")
        self.lbl_eta.config(text="")
        self.process = None

if __name__ == "__main__":
    root = tk.Tk()
    app = PipelineUI(root)
    root.mainloop()
