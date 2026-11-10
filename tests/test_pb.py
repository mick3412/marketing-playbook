"""End-to-end tests for pb.py with the marketing data. Each test works on a copy of the repo and an empty project folder.

    python3 -m unittest discover tests
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SIBLING = REPO.parent / "production-playbook" / "pb.py"


class PlaybookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.home = self.tmp / "playbook"
        shutil.copytree(REPO, self.home, ignore=shutil.ignore_patterns(".git", "__pycache__", "inbox", "skills", "tools"))
        self.project = self.tmp / "product"
        self.project.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def pb(self, *args, ok=True):
        env = {**os.environ, "MARKETING_PLAYBOOK_HOME": str(self.home), "CLAUDE_PROJECT_DIR": str(self.project)}
        p = subprocess.run([sys.executable, str(self.home / "pb.py"), *args], capture_output=True, text=True, env=env, cwd=self.project)
        if ok is True:
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        elif ok is False:
            self.assertNotEqual(p.returncode, 0, p.stdout + p.stderr)
        return p.stdout

    def test_check_passes_and_guide_is_current(self):
        self.assertIn("OK", self.pb("check"))

    @unittest.skipUnless(SIBLING.is_file(), "production-playbook is not next to this repo")
    def test_engine_matches_production_playbook(self):
        self.assertEqual((REPO / "pb.py").read_bytes(), SIBLING.read_bytes(), "copy pb.py between the two repos")

    def test_every_stage_card_has_all_sections(self):
        for stage in [str(i) for i in range(8)]:
            card = self.pb("card", stage)
            for heading in ("## 要做", "## 用什麼工具", "## 要注意", "## 讓品質更好、更獨特", "## 過關條件 → 下一步"):
                self.assertIn(heading, card, f"stage {stage} misses {heading}")

    def test_writing_card_shows_only_the_chosen_type_and_its_ways(self):
        email = self.pb("card", "3", "--type", "郵件序列")
        self.assertIn("3.6 郵件序列", email)
        self.assertNotIn("3.8 私訊", email)
        self.assertIn("(a) emails 技能", email)
        self.assertIn("做法：", self.pb("card", "1", "--brief"))

    def test_flow_uses_its_own_state_folder_and_name(self):
        self.pb("start", "demo", "--type", "社群貼文")
        self.assertTrue((self.project / ".marketing" / "active.json").is_file())
        self.assertFalse((self.project / ".production").exists())
        self.assertIn("進行中的作品（marketing-playbook）", self.pb("hook", "session"))
        self.assertIn("G0.1", self.pb("advance", ok=False))
        self.pb("check-off", "G0.1", "G0.2", "G0.3")
        self.assertIn("1 品牌策略", self.pb("advance"))
        self.pb("done")
        self.assertEqual(self.pb("hook", "prompt"), "")

    def test_similar_finds_the_matching_entry(self):
        self.assertIn("S3-09", self.pb("similar", "私訊第一則就推銷").splitlines()[0])

    def test_next_id_continues_numbering(self):
        self.assertRegex(self.pb("next-id", "3").strip(), r"^S3-\d{2}$")
        self.assertRegex(self.pb("next-id", "協作").strip(), r"^CO-\d{2}$")


    def _first_tool(self, status):
        import csv
        with open(self.home / "data" / "tools.csv", encoding="utf-8") as f:
            return next(t for t in csv.DictReader(f) if t["狀態"] == status)

    def test_tool_runs_drive_review(self):
        t = self._first_tool("待試")
        self.pb("run-log", "--entries", t["id"], "--result", "有效")
        self.pb("run-log", "--entries", t["id"], "--result", "有效")
        self.assertIn(t["id"], self.pb("review"))

    def test_open_items_need_test_method_and_recheck(self):
        import csv
        path = self.home / "data" / "tools.csv"
        with open(path, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        tid = next(r["id"] for r in rows if r["狀態"] == "待試")
        for r in rows:
            if r["id"] == tid:
                r["測試方法"] = ""
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]), quoting=csv.QUOTE_ALL, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
        self.assertIn(f"{tid}: 待試 needs 測試方法", self.pb("check", ok=False))


    def test_trials_caps_each_stage_and_drops_logged_items(self):
        import json, re
        stype = next(iter(json.loads((self.home / "data" / "stages.json").read_text(encoding="utf-8"))["asset_types"]))
        self.pb("start", "trial-demo", "--type", stype)
        out = self.pb("trials")
        for block in out.split("\n## ")[1:]:
            self.assertLessEqual(block.count("- [ ] **"), 3, block)
        first = re.search(r"- \[ \] \*\*([A-Z]+-\d+)\*\*", out)
        if first:
            self.pb("run-log", "--entries", first[1], "--result", "有效", "--name", "trial-demo")
            self.assertNotIn(f"**{first[1]}**", self.pb("trials"))
        if out.count("- [ ] **") > 1:
            self.assertIn("排定要測", self.pb("done", "trial-demo"))


if __name__ == "__main__":
    unittest.main()
