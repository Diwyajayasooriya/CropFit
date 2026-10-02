import secrets
import string
from django.core.management.base import BaseCommand
from apps.node.models.nodeDetails.models import Node


def generate_claim_code(length=8):
    alphabet = string.ascii_uppercase + string.digits
    # Exclude ambiguous characters: 0, O, 1, I
    clean_alphabet = [c for c in alphabet if c not in ('0', 'O', '1', 'I')]
    return ''.join(secrets.choice(clean_alphabet) for _ in range(length))


class Command(BaseCommand):
    help = "Pre-provision a new GreenNode edge hub in the manufacturing database"

    def add_arguments(self, parser):
        parser.add_argument('--device-id', type=str, help='Hardware Device ID (e.g. gn-hub-a1b2c3d4)')
        parser.add_argument('--code', type=str, help='Custom 8-char claim code (optional, auto-generated if omitted)')
        parser.add_argument('--name', type=str, default='GreenNode Hub', help='Default friendly name')
        parser.add_argument('--mac', type=str, default='', help='Primary MAC address (optional)')

    def handle(self, *args, **options):
        device_id = options.get('device_id')
        code = options.get('code')
        name = options.get('name')
        mac = options.get('mac')

        if not device_id:
            device_id = f"gn-hub-{secrets.token_hex(4)}"

        if not code:
            code = generate_claim_code(8)
        else:
            code = code.strip().upper()

        node, created = Node.objects.get_or_create(
            node_id=device_id,
            defaults={
                'node_name': name,
                'claim_code': code,
                'mac_address': mac or f"B8:27:EB:{secrets.token_hex(3)}",
                'is_claimed': False,
            }
        )

        if not created:
            self.stdout.write(self.style.WARNING(f"Node '{device_id}' already exists in database."))
            self.stdout.write(f"Claim Code : {node.claim_code}")
            self.stdout.write(f"Is Claimed : {node.is_claimed}")
            return

        self.stdout.write(self.style.SUCCESS("Successfully pre-provisioned GreenNode Hub:"))
        self.stdout.write(f"  Device ID   : {node.node_id}")
        self.stdout.write(f"  Claim Code  : {node.claim_code}")
        self.stdout.write(f"  Status      : Unclaimed")
        self.stdout.write(f"  Claim URL   : https://cropfit.com/claim?code={node.claim_code}")
        self.stdout.write(f"  QR Payload  : https://cropfit.com/claim?code={node.claim_code}")
