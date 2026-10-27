"""Tests for the Drive sync's checks and output (no Google account needed):  python3 -m unittest discover tests"""
import io
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import sync_drive  # noqa: E402


def png(size=(585, 559), box=(10, 20, 40, 60), fill=(200, 0, 0, 255), base=(0, 0, 0, 0)):
    im = Image.new("RGBA", size, base)
    if box:
        im.paste(Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), fill), box[:2])
    out = io.BytesIO()
    im.save(out, "PNG")
    return out.getvalue()


def entry(branch, section, name, data, size=None):
    return branch, "shirt", section, name, size if size is not None else len(data), lambda: data


class BuildTest(unittest.TestCase):
    def test_valid_files_are_cropped_and_listed(self):
        with tempfile.TemporaryDirectory() as site:
            skipped = []
            result = sync_drive.build([
                entry("CDF", "1. OUTERWEAR", "Cloak.png", png()),
                entry("CDF", "1. OUTERWEAR", "[MR1] Belt.png", png(box=(100, 100, 120, 130))),
            ], site, skipped)
            self.assertEqual(skipped, [])
            items = result["CDF"]["shirt"][0]["items"]
            self.assertEqual([i["name"] for i in items], ["[MR1] Belt", "Cloak"])   # sorted by name
            cloak = items[1]
            self.assertEqual((cloak["x"], cloak["y"]), (10, 20))
            self.assertTrue(cloak["src"].startswith("uploads/cdf/shirt/"))
            with Image.open(Path(site) / cloak["src"]) as im:
                self.assertEqual(im.size, (30, 40))

    def test_bad_files_are_skipped_with_a_reason(self):
        with tempfile.TemporaryDirectory() as site:
            skipped = []
            result = sync_drive.build([
                entry("CDF", "S", "notes.txt", b"hi"),
                entry("CDF", "S", "Small.png", png(size=(100, 100), box=(1, 1, 5, 5))),
                entry("CDF", "S", "Empty.png", png(box=None)),
                entry("CDF", "S", "Solid.png", png(box=None, base=(9, 9, 9, 255))),
                entry("CDF", "S", "Huge.png", png(), size=6 * 1024 * 1024),
                entry("CDF", "S", "Fake.png", b"not a png"),
                entry("CDF", "S", "Twice.png", png()),
                entry("CDF", "S", "twice.png", png()),
            ], site, skipped)
            reasons = dict(skipped)
            self.assertIn("not a .png file", reasons["CDF/Shirt/S/notes.txt"])
            self.assertIn("is 100x100, must be 585x559", reasons["CDF/Shirt/S/Small.png"])
            self.assertIn("completely transparent", reasons["CDF/Shirt/S/Empty.png"])
            self.assertIn("no transparent areas", reasons["CDF/Shirt/S/Solid.png"])
            self.assertIn("larger than 5 MB", reasons["CDF/Shirt/S/Huge.png"])
            self.assertIn("could not be read", reasons["CDF/Shirt/S/Fake.png"])
            self.assertIn("already has that name", reasons["CDF/Shirt/S/twice.png"])
            self.assertEqual([i["name"] for i in result["CDF"]["shirt"][0]["items"]], ["Twice"])

    def test_single_branch_reads_shirt_and_pants_from_the_root(self):
        saved, orig = sync_drive.BRANCHES, sync_drive.list_children
        try:
            sync_drive.BRANCHES = {"cdf": "CDF"}
            self.assertEqual(sync_drive.branch_folders(None, "ROOT", []), [("CDF", "ROOT", "")])
            sync_drive.BRANCHES = {"a": "A", "b": "B"}
            sync_drive.list_children = lambda s, pid: [
                {"id": "1", "name": "A", "mimeType": sync_drive.FOLDER}, {"id": "2", "name": "Notes.txt", "mimeType": "text/plain"}]
            skipped = []
            self.assertEqual(sync_drive.branch_folders(None, "ROOT", skipped), [("A", "1", "A/")])
            self.assertEqual(skipped[0][0], "Notes.txt")
        finally:
            sync_drive.BRANCHES = saved
            sync_drive.list_children = orig

    def test_branches_come_from_the_site_config(self):
        import json
        config = json.loads((Path(__file__).resolve().parent.parent / "data" / "branches.json").read_text(encoding="utf-8"))
        self.assertEqual(sorted(sync_drive.BRANCHES.values()), sorted(b["name"] for b in config["branches"]))
        for b in config["branches"]:
            self.assertEqual(sync_drive.BRANCHES[b["name"].lower()], b["name"])   # folder names match case-insensitively
            self.assertEqual(sync_drive.SLUG(b["name"]), b["slug"])


if __name__ == "__main__":
    unittest.main()
