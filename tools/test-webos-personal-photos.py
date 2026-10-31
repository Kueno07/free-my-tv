import importlib.util
import json
import os
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = importlib.util.spec_from_file_location('webos_build', os.path.join(ROOT, 'webos', 'build.py'))
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


class PersonalPhotoBuildTests(unittest.TestCase):
    def test_personal_build_includes_only_local_images_and_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            photo_dir = os.path.join(temp, 'photos.local')
            os.makedirs(photo_dir)
            with open(os.path.join(photo_dir, 'family.png'), 'wb') as f:
                f.write(b'\x89PNG\r\n\x1a\nfixture')
            with open(os.path.join(photo_dir, 'spoofed.jpg'), 'wb') as f:
                f.write(b'not a jpeg file')
            with open(os.path.join(photo_dir, 'not-a-photo.txt'), 'wb') as f:
                f.write(b'private text')
            with open(os.path.join(temp, 'calendar.local.json'), 'w', encoding='utf-8') as f:
                f.write('{"private":"event fixture"}')

            files = BUILD.application_files(BUILD.webapp.GENERIC, generic=False, photo_dir=photo_dir)
            manifest = json.loads(files['personal-photos.js'].decode('utf-8').split('=', 1)[1].strip().rstrip(';'))
            self.assertEqual(manifest, ['personal-photos/family.png'])
            self.assertEqual(files['personal-photos/family.png'], b'\x89PNG\r\n\x1a\nfixture')
            self.assertNotIn('not-a-photo.txt', files)
            self.assertNotIn('personal-photos/spoofed.jpg', files)
            self.assertFalse(any('calendar.local.json' in name for name in files))

    def test_generic_build_has_an_empty_manifest_and_no_local_files(self):
        with tempfile.TemporaryDirectory() as temp:
            photo_dir = os.path.join(temp, 'photos.local')
            os.makedirs(photo_dir)
            with open(os.path.join(photo_dir, 'family.jpg'), 'wb') as f:
                f.write(b'\xff\xd8\xfffixture')
            files = BUILD.application_files(BUILD.webapp.GENERIC, generic=True, photo_dir=photo_dir)
            manifest = json.loads(files['personal-photos.js'].decode('utf-8').split('=', 1)[1].strip().rstrip(';'))
            self.assertEqual(manifest, [])
            self.assertFalse(any(name.startswith('personal-photos/') for name in files))


if __name__ == '__main__':
    unittest.main()
