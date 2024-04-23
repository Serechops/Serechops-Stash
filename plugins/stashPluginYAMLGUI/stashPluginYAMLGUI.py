import tkinter as tk
from tkinter import messagebox, ttk, filedialog
import yaml
import os

class StashYAMLBuilder:
    def __init__(self, root):
        self.root = root
        self.root.title("Stash YAML Builder")
        
        self.main_frame = ttk.Frame(root, padding="20")
        self.main_frame.grid(row=0, column=0)

        self.name_var = tk.StringVar()
        self.description_var = tk.StringVar()
        self.version_var = tk.StringVar()
        self.url_var = tk.StringVar()
        
        self.css_files = []
        self.js_files = []
        self.py_files = []
        self.requires_plugins = []
        self.assets = {}
        self.csp_script_src = []
        self.csp_style_src = []
        self.csp_connect_src = []
        
        self.interface_var = tk.StringVar(value="raw")
        self.err_log_var = tk.StringVar(value="none")
        
        self.settings = {}
        
        # Define text variables for storing CSS, JS, Python, and Assets
        self.css_text = None
        self.js_text = None
        self.py_text = None
        self.assets_text = None
        
        # Initialize variables for tasks and hooks
        self.tasks_entries = []
        self.hooks_entries = []
        
        self.create_widgets()
        
    def create_widgets(self):
        # Plugin Information
        ttk.Label(self.main_frame, text="Plugin Name:").grid(row=0, column=0, padx=5, pady=5, sticky="e")
        ttk.Entry(self.main_frame, textvariable=self.name_var, width=40).grid(row=0, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Description:").grid(row=1, column=0, padx=5, pady=5, sticky="e")
        ttk.Entry(self.main_frame, textvariable=self.description_var, width=40).grid(row=1, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Version:").grid(row=2, column=0, padx=5, pady=5, sticky="e")
        ttk.Entry(self.main_frame, textvariable=self.version_var, width=40).grid(row=2, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="URL:").grid(row=3, column=0, padx=5, pady=5, sticky="e")
        ttk.Entry(self.main_frame, textvariable=self.url_var, width=40).grid(row=3, column=1, padx=5, pady=5)
        
        # Interface and Error Log
        ttk.Label(self.main_frame, text="Interface Type:").grid(row=4, column=0, padx=5, pady=5, sticky="e")
        ttk.Entry(self.main_frame, textvariable=self.interface_var, width=40).grid(row=4, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Error Log:").grid(row=5, column=0, padx=5, pady=5, sticky="e")
        ttk.Entry(self.main_frame, textvariable=self.err_log_var, width=40).grid(row=5, column=1, padx=5, pady=5)
        
        # Separator
        ttk.Separator(self.main_frame, orient="horizontal").grid(row=6, column=0, columnspan=2, sticky="ew", padx=5, pady=10)
        
        # Settings
        ttk.Label(self.main_frame, text="Setting Name:").grid(row=7, column=0, padx=5, pady=5, sticky="e")
        self.setting_name_var = tk.StringVar()
        ttk.Entry(self.main_frame, textvariable=self.setting_name_var, width=40).grid(row=7, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Display Name:").grid(row=8, column=0, padx=5, pady=5, sticky="e")
        self.setting_display_name_var = tk.StringVar()
        ttk.Entry(self.main_frame, textvariable=self.setting_display_name_var, width=40).grid(row=8, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Type:").grid(row=9, column=0, padx=5, pady=5, sticky="e")
        self.setting_type_var = tk.StringVar()
        ttk.Combobox(self.main_frame, textvariable=self.setting_type_var, values=["BOOLEAN", "NUMBER", "STRING"]).grid(row=9, column=1, padx=5, pady=5)
        
        ttk.Button(self.main_frame, text="Add Setting", command=self.add_setting).grid(row=10, column=0, columnspan=2, padx=5, pady=5)
        
        # Hooks
        ttk.Label(self.main_frame, text="Hook Name:").grid(row=11, column=0, padx=5, pady=5, sticky="e")
        self.hook_name_var = tk.StringVar()
        ttk.Entry(self.main_frame, textvariable=self.hook_name_var, width=40).grid(row=11, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Description:").grid(row=12, column=0, padx=5, pady=5, sticky="e")
        self.hook_description_var = tk.StringVar()
        ttk.Entry(self.main_frame, textvariable=self.hook_description_var, width=40).grid(row=12, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Triggered By:").grid(row=13, column=0, padx=5, pady=5, sticky="e")
        self.hook_triggered_by_var = tk.StringVar()
        ttk.Entry(self.main_frame, textvariable=self.hook_triggered_by_var, width=40).grid(row=13, column=1, padx=5, pady=5)
        
        ttk.Button(self.main_frame, text="Add Hook", command=self.add_hook).grid(row=14, column=0, columnspan=2, padx=5, pady=5)
        
        # Tasks
        ttk.Label(self.main_frame, text="Task Name:").grid(row=15, column=0, padx=5, pady=5, sticky="e")
        self.task_name_var = tk.StringVar()
        ttk.Entry(self.main_frame, textvariable=self.task_name_var, width=40).grid(row=15, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Description:").grid(row=16, column=0, padx=5, pady=5, sticky="e")
        self.task_description_var = tk.StringVar()
        ttk.Entry(self.main_frame, textvariable=self.task_description_var, width=40).grid(row=16, column=1, padx=5, pady=5)
        
        ttk.Label(self.main_frame, text="Mode:").grid(row=17, column=0, padx=5, pady=5, sticky="e")
        self.task_default_args_var = tk.StringVar()
        ttk.Entry(self.main_frame, textvariable=self.task_default_args_var, width=40).grid(row=17, column=1, padx=5, pady=5)
        
        # Add Task Button
        ttk.Button(self.main_frame, text="Add Task", command=self.add_task).grid(row=19, column=0, columnspan=2, padx=5, pady=5)
        
        # Separator
        ttk.Separator(self.main_frame, orient="horizontal").grid(row=20, column=0, columnspan=2, sticky="ew", padx=5, pady=10)
        
        # Browse Plugin Directory Button
        ttk.Button(self.main_frame, text="Browse Plugin Directory", command=self.browse_plugin_directory).grid(row=21, column=0, columnspan=2, padx=5, pady=5)
        
        # CSS Files
        ttk.Label(self.main_frame, text="CSS Files (One per line):").grid(row=22, column=0, padx=5, pady=5, sticky="e")
        self.css_text = tk.Text(self.main_frame, height=3, width=40)
        self.css_text.grid(row=22, column=1, padx=5, pady=5)
        
        # JS Files
        ttk.Label(self.main_frame, text="JS Files (One per line):").grid(row=23, column=0, padx=5, pady=5, sticky="e")
        self.js_text = tk.Text(self.main_frame, height=3, width=40)
        self.js_text.grid(row=23, column=1, padx=5, pady=5)
        
        # Python Files
        ttk.Label(self.main_frame, text="Python Files (One per line):").grid(row=24, column=0, padx=5, pady=5, sticky="e")
        self.py_text = tk.Text(self.main_frame, height=3, width=40)
        self.py_text.grid(row=24, column=1, padx=5, pady=5)
        
        # Assets
        ttk.Label(self.main_frame, text="Assets (One per line, Format: urlPrefix fsLocation):").grid(row=25, column=0, padx=5, pady=5, sticky="e")
        self.assets_text = tk.Text(self.main_frame, height=3, width=40)
        self.assets_text.grid(row=25, column=1, padx=5, pady=5)
        
        # Build Button
        self.build_button = ttk.Button(self.main_frame, text="Build Plugin YAML", command=self.build_yaml)
        self.build_button.grid(row=26, column=0, columnspan=2, padx=5, pady=5)

        
    def browse_plugin_directory(self):
        directory = filedialog.askdirectory()
        if directory:
            css_files = [file for file in os.listdir(directory) if file.endswith(".css")]
            js_files = [file for file in os.listdir(directory) if file.endswith(".js")]
            py_files = [file for file in os.listdir(directory) if file.endswith(".py")]

            self.css_text.delete(1.0, tk.END)
            for file in css_files:
                self.css_text.insert(tk.END, file + "\n")

            self.js_text.delete(1.0, tk.END)
            for file in js_files:
                self.js_text.insert(tk.END, file + "\n")

            self.py_text.delete(1.0, tk.END)
            for file in py_files:
                self.py_text.insert(tk.END, file + "\n")
        
    def add_setting(self):
        setting_name = self.setting_name_var.get()
        setting_display_name = self.setting_display_name_var.get()
        setting_type = self.setting_type_var.get()
        
        if setting_name and setting_display_name and setting_type:
            self.settings[setting_name] = {"displayName": setting_display_name, "type": setting_type}
            self.clear_setting_fields()
            messagebox.showinfo("Setting Added", f"Setting '{setting_name}' added successfully.")
        else:
            messagebox.showerror("Error", "Please fill in all fields.")
    
    def clear_setting_fields(self):
        self.setting_name_var.set("")
        self.setting_display_name_var.set("")
        self.setting_type_var.set("")
        
    def build_yaml(self):
        yaml_data = {
            "name": self.name_var.get(),
            "description": self.description_var.get(),
            "version": self.version_var.get(),
            "url": self.url_var.get(),
            "ui": {
                "css": [],
                "assets": {},
                "csp": {
                    "script-src": self.csp_script_src,
                    "style-src": self.csp_style_src,
                    "connect-src": self.csp_connect_src
                },
                "javascript": [],  
                "python": []       
            },
            "settings": self.settings,
            "interface": self.interface_var.get(),
            "errLog": self.err_log_var.get(),
        }
    
        # Parse CSS, JS, and Python files
        css_files = self.css_text.get("1.0", "end").strip().split("\n")
        js_files = self.js_text.get("1.0", "end").strip().split("\n")
        py_files = self.py_text.get("1.0", "end").strip().split("\n")
    
        for css_file in css_files:
            yaml_data["ui"]["css"].append(css_file)
    
        for js_file in js_files:
            if js_file.endswith(" - ui"):
                yaml_data["ui"]["javascript"].append(js_file.replace(' - ui', ''))
            else:
                yaml_data["ui"]["javascript"].append(f"{{pluginDir}}/{js_file}")
    
        for py_file in py_files:
            if py_file.endswith(" - ui"):
                yaml_data["ui"]["python"].append(py_file.replace(' - ui', ''))
            else:
                yaml_data["ui"]["python"].append(f"{{pluginDir}}/{py_file}")
    
        # Check if any exec entries are added
        if yaml_data["ui"]["javascript"]:
            yaml_data["exec"] = yaml_data["ui"]["javascript"]
            del yaml_data["ui"]["javascript"]
    
        if yaml_data["ui"]["python"]:
            yaml_data["exec"].extend(yaml_data["ui"]["python"])
            del yaml_data["ui"]["python"]
    
        # Remove empty lists from 'ui'
        if not yaml_data["ui"]["css"]:
            del yaml_data["ui"]["css"]
    
        # Remove 'ui' if it's empty
        if not yaml_data["ui"]:
            del yaml_data["ui"]
    
        # Check if Tasks section should be included
        tasks_data = self.build_tasks()
        if tasks_data:
            yaml_data["tasks"] = tasks_data
    
        # Check if Hooks section should be included
        hooks_data = self.build_hooks()
        if hooks_data:
            yaml_data["hooks"] = hooks_data
    
        # Write YAML data to file
        yaml_file = os.path.join(os.getcwd(), self.name_var.get() + ".yml")
        with open(yaml_file, "w") as f:
            yaml.dump(yaml_data, f, default_flow_style=False)
    
        # Show message box with confirmation
        messagebox.showinfo("YAML Built", f"YAML file saved as: {yaml_file}")


    
    def build_tasks(self):
        tasks_data = []
        for entry in self.tasks_entries:
            name = entry["name"]
            desc = entry["description"]
            mode = entry["mode"]
            if name.strip() and desc.strip() and mode.strip():
                task_data = {
                    "name": name.strip(),
                    "description": desc.strip(),
                    "defaultArgs": {
                        "mode": mode.strip()
                    }
                }
                tasks_data.append(task_data)
        return tasks_data



    
    def build_hooks(self):
        hooks_data = []
        for entry in self.hooks_entries:
            name = entry["name"]
            desc = entry["description"]
            triggered_by = entry["triggeredBy"]
            if name.strip() and desc.strip() and triggered_by.strip():
                hook_data = {"name": name.strip(), "description": desc.strip(), "triggeredBy": [triggered_by.strip()]}
                hooks_data.append(hook_data)
        return hooks_data


    
    def add_task(self):
        # Clear entry fields
        name = self.task_name_var.get()
        desc = self.task_description_var.get()
        mode = self.task_default_args_var.get()  # Update to get mode instead of defaultArgs
        
        if name.strip() and desc.strip() and mode.strip():
            self.tasks_entries.append({"name": name.strip(), "description": desc.strip(), "mode": mode.strip()})  # Update to include mode
            self.clear_task_fields()
            messagebox.showinfo("Task Added", "Task added successfully.")
        else:
            messagebox.showerror("Error", "Please fill in all fields for the task.")

        
    def add_hook(self):
        # Clear entry fields
        name = self.hook_name_var.get()
        desc = self.hook_description_var.get()
        triggered_by = self.hook_triggered_by_var.get()
        
        if name.strip() and desc.strip() and triggered_by.strip():
            self.hooks_entries.append({"name": name.strip(), "description": desc.strip(), "triggeredBy": triggered_by.strip()})
            self.clear_hook_fields()
            messagebox.showinfo("Hook Added", "Hook added successfully.")
        else:
            messagebox.showerror("Error", "Please fill in all fields for the hook.")

    def clear_task_fields(self):
        self.task_name_var.set("")
        self.task_description_var.set("")
        self.task_default_args_var.set("")

    def clear_hook_fields(self):
        self.hook_name_var.set("")
        self.hook_description_var.set("")
        self.hook_triggered_by_var.set("")

if __name__ == "__main__":
    root = tk.Tk()
    app = StashYAMLBuilder(root)
    root.mainloop()
