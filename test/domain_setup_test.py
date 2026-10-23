import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout

spec = importlib.util.spec_from_file_location('domain_setup', Path(__file__).resolve().parents[1] / 'deploy/setup-domain.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

OLD = 'api-bemfhunnes26.duckdns.org {\n    encode gzip zstd\n    reverse_proxy api:8080\n}\n'


class DomainSetupTests(unittest.TestCase):
    def test_merge_preserves_previous_site_and_is_idempotent(self):
        combined = setup.merge_caddy(OLD)
        self.assertTrue(combined.startswith(OLD))
        self.assertEqual(combined.count(setup.BEGIN), 1)
        self.assertIn('reverse_proxy photobooth-kartini:8787', combined)
        self.assertIn('camera=(self)', combined)
        self.assertIn('www.fotokartinirembang.com', combined)
        self.assertEqual(setup.merge_caddy(combined), combined)

    def test_unmanaged_or_broken_domain_config_is_not_overwritten(self):
        for existing in (OLD + setup.DOMAIN + ' {}', OLD + setup.BEGIN, setup.BEGIN + setup.END + setup.BEGIN + setup.END):
            with self.assertRaises(setup.SetupError):
                setup.merge_caddy(existing)

    def test_override_keeps_both_networks_without_publishing_ports(self):
        content = setup.override_content('bemfhunnes26_default')
        self.assertIn('default: {}', content)
        self.assertIn('external: true', content)
        self.assertIn('name: "bemfhunnes26_default"', content)
        self.assertIn('PUBLIC_BASE_URL: "https://fotokartinirembang.com"', content)
        self.assertNotIn('ports:', content)
        self.assertNotIn('DUCKDNS_API_TOKEN', content)

    def fixture(self, failure=None, existing=None):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        caddyfile = root / 'gateway' / 'Caddyfile'
        caddyfile.parent.mkdir()
        caddyfile.write_text(OLD)
        override = root / 'compose.override.yaml'
        if existing is not None:
            override.write_text(existing)
        operations = []
        reloaded = 0

        def fake_run(args, *, input=None, cwd=None, timeout=120):
            nonlocal reloaded
            operations.append(args)
            if 'validate' in args:
                self.assertEqual(caddyfile.read_text(), OLD)
                self.assertIn(setup.DOMAIN, input)
                if failure == 'validate':
                    raise setup.SetupError('invalid Caddyfile')
            if args[:3] == ['docker', 'compose', 'config'] and '--format' in args:
                return json.dumps({'services': {'app': {'environment': {'PUBLIC_BASE_URL': setup.BASE_URL}, 'networks': {'default': {}, 'domain_gateway': {'aliases': [setup.ALIAS]}}}}, 'networks': {'domain_gateway': {'name': 'bemfhunnes26_default'}}})
            if 'up' in args:
                self.assertEqual(caddyfile.read_text(), OLD)
                if failure == 'app' and operations.count(args) == 1:
                    raise setup.SetupError('app failed')
            if 'cat' in args:
                return caddyfile.read_text()
            if 'reload' in args:
                reloaded += 1
                if failure == 'reload' and reloaded == 1:
                    raise setup.SetupError('reload failed')
            return ''
        return root, caddyfile, override, operations, fake_run

    def configure(self, root, caddyfile, fake_run, verify=None):
        with patch.object(setup, 'run', side_effect=fake_run), patch.object(setup, 'check_dns'), patch.object(setup, 'discover_gateway', return_value=('primary', caddyfile, 'bemfhunnes26_default')), patch.object(setup, 'verify_https', side_effect=verify), patch.dict(setup.os.environ, {}, clear=True), redirect_stdout(io.StringIO()):
            setup.configure(root)

    def test_success_backs_up_preserves_site_and_persists_alias(self):
        root, caddyfile, override, calls, run = self.fixture()
        self.configure(root, caddyfile, run)
        self.assertEqual(override.read_text(), setup.override_content('bemfhunnes26_default'))
        self.assertTrue(caddyfile.read_text().startswith(OLD))
        self.assertEqual(list((root / 'backups').glob('domain-*/Caddyfile'))[0].read_text(), OLD)
        self.assertEqual(sum('reload' in c for c in calls), 1)
        self.assertEqual(sum('up' in c for c in calls), 1)
        self.assertTrue(all('down' not in c for c in calls))

    def test_validation_failure_does_not_modify_files_or_containers(self):
        root, caddyfile, override, calls, run = self.fixture('validate')
        with self.assertRaises(setup.SetupError):
            self.configure(root, caddyfile, run)
        self.assertEqual(caddyfile.read_text(), OLD)
        self.assertFalse(override.exists())
        self.assertFalse(any('up' in c for c in calls))

    def test_failure_rolls_back_config_and_app_including_previous_managed_override(self):
        for failure in ('app', 'reload', 'https'):
            for previous in (None, setup.MARKER + '\nservices: {}\n'):
                with self.subTest(failure=failure, previous=previous):
                    root, caddyfile, override, calls, run = self.fixture(failure, previous)
                    with self.assertRaises(setup.SetupError):
                        self.configure(root, caddyfile, run, setup.SetupError('TLS failed') if failure == 'https' else None)
                    self.assertEqual(caddyfile.read_text(), OLD)
                    self.assertEqual(override.read_text() if override.exists() else None, previous)
                    self.assertEqual(sum('up' in c for c in calls), 2)

    def test_existing_unmanaged_override_is_never_overwritten(self):
        root, caddyfile, override, calls, run = self.fixture(existing='services: {app: {}}\n')
        with self.assertRaises(setup.SetupError):
            self.configure(root, caddyfile, run)
        self.assertEqual(override.read_text(), 'services: {app: {}}\n')
        self.assertEqual(calls, [])

    def test_discovers_only_gateway_publishing_host_port_443(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'Caddyfile'
            source.write_text(OLD)
            def run(args, **kwargs):
                if 'ps' in args:
                    return 'photo\nprimary\n'
                return json.dumps({'id': args[-1], 'mounts': [{'Type': 'bind', 'Source': str(source), 'Destination': '/etc/caddy/Caddyfile'}], 'ports': {'443/tcp': [{'HostPort': '8443' if args[-1] == 'photo' else '443'}]}, 'networks': {'bemfhunnes26_default': {}}, 'project': 'bemfhunnes26'})
            with patch.object(setup, 'run', side_effect=run):
                self.assertEqual(setup.discover_gateway(), ('primary', source, 'bemfhunnes26_default'))

    def test_dns_rejects_wrong_addresses_and_accepts_expected_vps(self):
        with patch.object(setup.socket, 'getaddrinfo', return_value=[(2, 1, 6, '', (setup.VPS_IP, 443))]):
            setup.check_dns()
        for ip in ('127.0.0.1', '2001:db8::1'):
            with patch.object(setup.socket, 'getaddrinfo', return_value=[(2, 1, 6, '', (ip, 443))]), self.assertRaises(setup.SetupError):
                setup.check_dns()

    def test_https_checks_real_health_schema_and_www(self):
        class Response(io.StringIO):
            status = 200
        requested = []
        def open_url(url, **kwargs):
            requested.append(url)
            return Response(json.dumps({'ok': True, 'mode': 'openrouter'}))
        with patch.object(setup.urllib.request, 'urlopen', side_effect=open_url):
            setup.verify_https()
        self.assertEqual(requested, [setup.BASE_URL + '/api/health', 'https://www.' + setup.DOMAIN + '/api/health'])


if __name__ == '__main__':
    unittest.main()
